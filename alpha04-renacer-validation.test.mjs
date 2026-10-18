import assert from 'node:assert/strict';
import {validateRules} from './catalog-validation.js';
const example={rules:[{event:'on_survive',condition:{type:'always',value:''},conditions:[],target:'self',action:{type:'stat_change',stat:'defense',value:'+1'},chance:100,duration:0,limit:0}]};
assert.doesNotThrow(()=>validateRules(example,'abilities'));
assert.doesNotThrow(()=>validateRules(example,'moves'));
console.log('Al sobrevivir is valid for configured rules.');
