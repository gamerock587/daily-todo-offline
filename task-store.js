(function(root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.TodoStore = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function() {
  'use strict';
  function validate(data) {
    if (!data || data.version !== 1 || !Array.isArray(data.tasks) || !Array.isArray(data.snippets)) throw new Error('Choose a Daily ToDo version 1 JSON backup.');
    if (data.tasks.length > 10000 || data.snippets.length > 1000) throw new Error('Backup exceeds the supported item limit.');
    const ids = new Set();
    const tasks = data.tasks.map(t => {
      if (!t || typeof t.id !== 'string' || !t.id || ids.has(t.id) || typeof t.text !== 'string' || !t.text.trim() || t.text.length > 2000 || typeof t.completed !== 'boolean') throw new Error('Backup contains an invalid or duplicate task.');
      ids.add(t.id); return {id:t.id, text:t.text.trim(), completed:t.completed};
    });
    const snippets = data.snippets.map(s => {if (typeof s !== 'string' || s.length > 20000) throw new Error('Backup contains an invalid snippet.'); return s;});
    return {version:1,tasks,snippets};
  }
  return {validate};
});
