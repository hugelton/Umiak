const dock=document.getElementById('dock');
const tabs=[...document.querySelectorAll('.dock-tab')];
function activate(id){
 for(const tab of tabs)tab.setAttribute('aria-selected',String(tab.dataset.target===id));
 for(const pane of document.querySelectorAll('.dock-pane'))pane.hidden=pane.id!==id;
 dock.classList.remove('is-collapsed');
 document.getElementById('dock-toggle').setAttribute('aria-expanded','true');
}
for(const tab of tabs)tab.addEventListener('click',()=>activate(tab.dataset.target));
document.getElementById('dock-toggle').addEventListener('click',()=>{
 const collapsed=dock.classList.toggle('is-collapsed');
 document.getElementById('dock-toggle').setAttribute('aria-expanded',String(!collapsed));
});
window.addEventListener('keydown',e=>{
 if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement||e.target instanceof HTMLTextAreaElement||e.metaKey||e.ctrlKey||e.altKey)return;
 if(['1','2','3'].includes(e.key))activate(['wave-panel','sequence-panel','keyboard-panel'][Number(e.key)-1]);
});
