import test from 'node:test';
import assert from 'node:assert/strict';
import { clockCommandError } from '../../dist-electron/src/shared/clock-command.js';
const enabled={stealMode:true,clockMode:true};
test('empty or partial start backfill is rejected, complete second-level input is accepted',()=>{
 for(const startTime of ['',undefined,'09:', '25:00:00'])assert.ok(clockCommandError({action:'start',startTime},enabled));
 assert.equal(clockCommandError({action:'start',startTime:'09:00:01'},enabled),'');
});
test('finish needs both actual times, while historical edit can clear existing facts',()=>{
 assert.ok(clockCommandError({action:'finish',startTime:'09:00:00',endTime:''},enabled));
 assert.ok(clockCommandError({action:'finish',startTime:'',endTime:'17:00:00'},enabled));
 assert.equal(clockCommandError({action:'finish',startTime:'09:00:00',endTime:'17:00:00'},enabled),'');
 assert.equal(clockCommandError({action:'edit',startTime:'',endTime:''},enabled),'');
});
test('mode dependency is enforced on main input as well as the UI',()=>{
 assert.ok(clockCommandError({action:'start',startTime:'09:00:00'},{stealMode:false,clockMode:false}));
 assert.ok(clockCommandError({action:'start',startTime:'09:00:00'},{stealMode:true,clockMode:false}));
 assert.equal(clockCommandError({action:'pause'},{stealMode:true,clockMode:false}),'');
 assert.ok(clockCommandError({action:'pause'},null));
});
