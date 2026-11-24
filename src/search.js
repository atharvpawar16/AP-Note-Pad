const q = document.getElementById('q'), r = document.getElementById('r');
q.oninput = async () => {
  const res = await window.ap.search(q.value); r.innerHTML = '';
  for (const x of res) {
    const li = document.createElement('li'); if (x.done) li.className = 'done';
    const s = document.createElement('span'); s.textContent = x.text;
    const m = document.createElement('small'); m.textContent = window.APDates.pretty(x.day);
    li.append(s, m); li.onclick = () => window.ap.openResult(x.id, x.day); r.append(li);
  }
};
document.onkeydown = e => { if (e.key === 'Escape') window.close(); };
