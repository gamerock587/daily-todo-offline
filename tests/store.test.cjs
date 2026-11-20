const {test}=require('node:test');
const assert=require('node:assert/strict');
const {validate}=require('../task-store');
test('backup preserves task completion and Unicode text',()=>{
 const data={version:1,tasks:[{id:'one',text:'مهمة يومية',completed:true}],snippets:['<script>plain text</script>']};
 assert.deepEqual(validate(JSON.parse(JSON.stringify(data))),data);
});
test('invalid backups cannot replace existing state',()=>{
 const previous={version:1,tasks:[{id:'one',text:'Keep me',completed:false}],snippets:[]};
 const snapshot=JSON.stringify(previous);
 for(const bad of [null,{}, {...previous,version:2},{...previous,tasks:[previous.tasks[0],previous.tasks[0]]},{...previous,tasks:[{id:'two',text:'',completed:false}]},{...previous,snippets:[{}]}]) assert.throws(()=>validate(bad));
 assert.equal(JSON.stringify(previous),snapshot);
});
