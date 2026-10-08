// Medicines, lab results and remembered facts.
import { createRoute } from '@hono/zod-openapi';
import { HTTPException } from 'hono/http-exception';

import {
  DoseTakenSchema,
  FactPatchSchema,
  FactSchema,
  FactsSchema,
  IdParam,
  LabInputSchema,
  LabSchema,
  LabsSchema,
  MedicationSchema,
  MedicationsSchema,
  MedInputSchema,
  MedPatchSchema,
  OkSchema,
} from '../contract.ts';
import { localDateTime } from '../core/dates.ts';
import { withinRange } from '../core/labs.ts';
import type { FactDoc, LabDoc } from '../store/types.ts';
import { jsonBody, jsonRes, profileOf, todayFor, toMedication, type App, type AppDeps } from './shared.ts';

const sec = [{ firebase: [] }];

const toLab = (l: LabDoc) => ({
  id: l.id,
  test_date: l.test_date,
  test_name: l.test_name,
  test_label: l.test_label,
  value: l.value,
  unit: l.unit,
  reference_range: l.reference_range,
  within_range: withinRange(l.value, l.reference_range),
});
const toFact = (f: FactDoc) => ({ id: f.id, fact: f.fact, category: f.category, updated_at: f.updated_at });

export function registerRecords(app: App, { services: s }: AppDeps) {
  // ---------------------------------------------------------------- medicines
  app.openapi(
    createRoute({ method: 'get', path: '/meds', tags: ['medicines'], security: sec, responses: { 200: jsonRes(MedicationsSchema, 'All medicines (active first)') } }),
    async (c) => {
      const rows = await s.store.user(c.get('uid')).medications.find({}, { sort: { created_at: 1 } });
      rows.sort((a, b) => Number(b.active) - Number(a.active));
      return c.json({ medications: rows.map(toMedication) }, 200);
    },
  );

  app.openapi(
    createRoute({ method: 'post', path: '/meds', tags: ['medicines'], security: sec, request: { body: jsonBody(MedInputSchema) }, responses: { 200: jsonRes(MedicationSchema, 'Added') } }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const today = todayFor(s, await profileOf(u));
      const m = await u.medications.insertOne({ ...c.req.valid('json'), active: true, start_date: today, end_date: null });
      return c.json(toMedication(m), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/meds/{id}',
      tags: ['medicines'],
      security: sec,
      request: { params: IdParam, body: jsonBody(MedPatchSchema) },
      responses: { 200: jsonRes(MedicationSchema, 'Updated. Setting active=false records the stop date (it counts as a medication change for delay insights).') },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const today = todayFor(s, await profileOf(u));
      const patch = c.req.valid('json');
      const m = await u.medications.updateOne(
        { id: c.req.valid('param').id },
        { ...patch, ...(patch.active === false ? { end_date: today } : patch.active === true ? { end_date: null } : {}) },
      );
      if (!m) throw new HTTPException(404, { message: 'not_found' });
      return c.json(toMedication(m), 200);
    },
  );

  app.openapi(
    createRoute({
      method: 'post',
      path: '/meds/{id}/dose',
      tags: ['medicines'],
      security: sec,
      request: { params: IdParam, body: jsonBody(DoseTakenSchema) },
      responses: { 200: jsonRes(OkSchema, 'Dose marked taken / not taken') },
    }),
    async (c) => {
      const u = s.store.user(c.get('uid'));
      const p = await profileOf(u);
      const med = await u.medications.findOne({ id: c.req.valid('param').id });
      if (!med) throw new HTTPException(404, { message: 'not_found' });
      const { day, time, taken } = c.req.valid('json');
      const scheduled_for = localDateTime(day, time, p.timezone);
      if (taken) await u.med_intake.updateOne({ medication_id: med.id, scheduled_for }, { taken: true, taken_at: s.now().toISOString() }, { upsert: true });
      else await u.med_intake.deleteOne({ medication_id: med.id, scheduled_for });
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- labs
  app.openapi(
    createRoute({ method: 'get', path: '/labs', tags: ['labs'], security: sec, responses: { 200: jsonRes(LabsSchema, 'Lab results, oldest first') } }),
    async (c) => c.json({ labs: (await s.store.user(c.get('uid')).lab_results.find({}, { sort: { test_date: 1 } })).map(toLab) }, 200),
  );

  app.openapi(
    createRoute({ method: 'post', path: '/labs', tags: ['labs'], security: sec, request: { body: jsonBody(LabInputSchema) }, responses: { 200: jsonRes(LabSchema, 'Added') } }),
    async (c) => c.json(toLab(await s.store.user(c.get('uid')).lab_results.insertOne(c.req.valid('json'))), 200),
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/labs/{id}', tags: ['labs'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Deleted') } }),
    async (c) => {
      if (!(await s.store.user(c.get('uid')).lab_results.deleteOne({ id: c.req.valid('param').id }))) throw new HTTPException(404, { message: 'not_found' });
      return c.json({ ok: true as const }, 200);
    },
  );

  // ---------------------------------------------------------------- what Companion remembers
  app.openapi(
    createRoute({ method: 'get', path: '/facts', tags: ['memory'], security: sec, responses: { 200: jsonRes(FactsSchema, 'Active remembered facts, newest first') } }),
    async (c) => c.json({ facts: (await s.store.user(c.get('uid')).facts.find({ active: true }, { sort: { updated_at: -1 } })).map(toFact) }, 200),
  );

  app.openapi(
    createRoute({
      method: 'patch',
      path: '/facts/{id}',
      tags: ['memory'],
      security: sec,
      request: { params: IdParam, body: jsonBody(FactPatchSchema) },
      responses: { 200: jsonRes(FactSchema, 'Edited') },
    }),
    async (c) => {
      const { fact } = c.req.valid('json');
      // Edited text no longer matches its old embedding.
      const embedding = await s.embed(fact).catch(() => null);
      const f = await s.store.user(c.get('uid')).facts.updateOne({ id: c.req.valid('param').id }, { fact, embedding, updated_at: s.now().toISOString() });
      if (!f) throw new HTTPException(404, { message: 'not_found' });
      return c.json(toFact(f), 200);
    },
  );

  app.openapi(
    createRoute({ method: 'delete', path: '/facts/{id}', tags: ['memory'], security: sec, request: { params: IdParam }, responses: { 200: jsonRes(OkSchema, 'Forgotten') } }),
    async (c) => {
      if (!(await s.store.user(c.get('uid')).facts.deleteOne({ id: c.req.valid('param').id }))) throw new HTTPException(404, { message: 'not_found' });
      return c.json({ ok: true as const }, 200);
    },
  );
}
