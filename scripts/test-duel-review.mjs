import assert from 'node:assert/strict';
import {createClient} from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const key = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
assert.ok(url && key, 'Supply public Supabase configuration');

const guest = () => createClient(url, key, {auth:{persistSession:false, autoRefreshToken:false}});
const clients = [guest(), guest()];
const outsider = guest();

async function rpc(client, action, payload = {}) {
  const {data, error} = ['create', 'join'].includes(action)
    ? await client.functions.invoke('game', {body:{action, payload}})
    : await client.rpc('geoduel', {action, payload});
  assert.ifError(error);
  assert.ok(!data?.error, data?.error);
  return data;
}

async function profile(client, nickname) {
  const {data, error} = await client.auth.signInAnonymously();
  assert.ifError(error);
  assert.ok(data.user?.is_anonymous);
  const {id} = await rpc(client, 'profile', {nickname});
  assert.equal(id, data.user.id);
  return id;
}

const ids = await Promise.all([
  profile(clients[0], 'QA Review Nord'),
  profile(clients[1], 'QA Review Süd'),
]);
assert.notEqual(ids[0], ids[1]);
await profile(outsider, 'QA Review Zuschauer');
const room = await rpc(clients[0], 'create', {perCategory:2});
const payload = {roomId:room.id};

async function reviewDenied(client, message) {
  const {data, error} = await client.rpc('geoduel', {action:'review', payload});
  assert.ifError(error);
  assert.deepEqual(data, {error:message});
}

try {
  await reviewDenied(clients[0], 'Die Auflösung ist nach Duellende verfügbar.');
  await rpc(clients[1], 'join', {code:room.code});
  await rpc(clients[0], 'configure', {...payload, categories:['flags', 'maps', 'silhouettes', 'world']});
  await Promise.all(clients.map(client => rpc(client, 'ready', {...payload, ready:true})));
  const started = await rpc(clients[0], 'start', payload);
  assert.equal(started.total, 8);
  await reviewDenied(outsider, 'Du gehörst nicht zu diesem Duell.');

  const questions = [];
  const played = [[], []];
  for (const [player, client] of clients.entries()) {
    for (let position = 0; position < started.total; position++) {
      const snapshot = await rpc(client, 'snapshot', payload);
      assert.equal(snapshot.cursor, position);
      assert.equal(snapshot.status, 'playing');
      assert.equal(snapshot.result, undefined);
      if (player === 0) questions.push(snapshot.question);
      else assert.deepEqual(snapshot.question, questions[position]);

      const first = played[0][position];
      const option = first
        ? [first.selected, (first.correct + 1) % 4, first.correct, (first.correct + 2) % 4][position % 4]
        : position % 4;
      const {feedback} = await rpc(client, 'answer', {...payload, position, option});
      assert.equal(feedback.selected, option);
      assert.equal(feedback.points, option === feedback.correct ? snapshot.question.difficulty : 0);
      played[player].push(feedback);
      if (position === 0) await reviewDenied(client, 'Die Auflösung ist nach Duellende verfügbar.');
      await rpc(client, 'next', {...payload, position});
    }
    if (player === 0) {
      for (const participant of clients) await reviewDenied(participant, 'Die Auflösung ist nach Duellende verfügbar.');
    }
  }

  const {status, result} = await rpc(clients[0], 'snapshot', payload);
  assert.equal(status, 'completed');
  const statsBefore = await Promise.all(clients.map(client => rpc(client, 'stats')));
  const reviews = await Promise.all(clients.map(client => rpc(client, 'review', payload)));
  for (const [player, review] of reviews.entries()) {
    assert.equal(review.length, started.total);
    for (const [position, question] of questions.entries()) {
      const entry = review[position];
      const own = played[player][position];
      assert.deepEqual(
        {position:entry.position, category:entry.category, prompt:entry.prompt, options:entry.options, media:entry.media},
        {position, category:question.category, prompt:question.prompt, options:question.options, media:question.media},
      );
      assert.equal(entry.correct, own.correct);
      assert.equal(entry.explanation, own.explanation);
      assert.equal(entry.selected, own.selected);
      assert.equal(entry.points, own.points);
      assert.equal(entry.answers.length, 2);
      for (const [p, id] of ids.entries()) {
        const {selected, points} = played[p][position];
        assert.deepEqual(entry.answers.find(answer => answer.profileId === id), {profileId:id, selected, points});
      }
    }
    const score = result.players.find(playerResult => playerResult.id === ids[player]);
    assert.equal(score.points, review.reduce((sum, entry) => sum + entry.points, 0));
    assert.equal(score.correct, review.filter(entry => entry.selected === entry.correct).length);
  }
  assert.deepEqual(reviews[0].map(entry => entry.answers), reviews[1].map(entry => entry.answers));
  assert.deepEqual(await Promise.all(clients.map(client => rpc(client, 'review', payload))), reviews);
  assert.deepEqual(await Promise.all(clients.map(client => rpc(client, 'stats'))), statsBefore);
  assert.deepEqual((await rpc(clients[1], 'snapshot', payload)).result, result);
  await reviewDenied(outsider, 'Du gehörst nicht zu diesem Duell.');
  const anonymous = await guest().rpc('geoduel', {action:'review', payload});
  assert.ok(anonymous.error);
  assert.equal(anonymous.data, null);
  console.log('PASS: 8 questions, 2 independent anonymous profiles, saved choices and points, option order, repeat reads, in-progress and outsider access denied');
} finally {
  const snapshot = await rpc(clients[0], 'snapshot', payload);
  if (snapshot.status === 'playing' || snapshot.status === 'waiting') await rpc(clients[0], 'leave', payload);
}
