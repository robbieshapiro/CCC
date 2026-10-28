// The fall kit: a quarter-zip in your school's colours with its letters on the chest. Colours and letters only, no
// logos. The picker is a searchable sheet used from the home banner and the locker.
// no imports: the golfer reads this list too, and it has to load without the app around it
const esc = (t: string) => t.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);

export type Kit = { key: string; name: string; mono: string; primary: string; secondary: string };

const k = (key: string, name: string, mono: string, primary: string, secondary: string): Kit => ({ key, name, mono, primary, secondary });

export const KITS: Kit[] = [
  // SEC
  k('alabama', 'Alabama', 'A', '#9e1b32', '#f4f1e8'),
  k('arkansas', 'Arkansas', 'A', '#9d2235', '#f4f1e8'),
  k('auburn', 'Auburn', 'AU', '#0c2340', '#e87722'),
  k('florida', 'Florida', 'UF', '#0021a5', '#fa4616'),
  k('georgia', 'Georgia', 'G', '#ba0c2f', '#111111'),
  k('kentucky', 'Kentucky', 'UK', '#0033a0', '#f4f1e8'),
  k('lsu', 'LSU', 'LSU', '#461d7c', '#fdd023'),
  k('olemiss', 'Ole Miss', 'OM', '#14213d', '#ce1126'),
  k('msstate', 'Mississippi State', 'M', '#5d1725', '#f4f1e8'),
  k('mizzou', 'Missouri', 'MIZ', '#111111', '#f1b82d'),
  k('oklahoma', 'Oklahoma', 'OU', '#841617', '#fdf9d8'),
  k('southcarolina', 'South Carolina', 'C', '#73000a', '#111111'),
  k('tennessee', 'Tennessee', 'T', '#ff8200', '#f4f1e8'),
  k('texas', 'Texas', 'UT', '#bf5700', '#f4f1e8'),
  k('tamu', 'Texas A&M', 'ATM', '#500000', '#f4f1e8'),
  k('vanderbilt', 'Vanderbilt', 'V', '#111111', '#cfae70'),
  // Big Ten
  k('illinois', 'Illinois', 'I', '#13294b', '#e84a27'),
  k('indiana', 'Indiana', 'IU', '#990000', '#eeedeb'),
  k('iowa', 'Iowa', 'IA', '#111111', '#ffcd00'),
  k('maryland', 'Maryland', 'M', '#e21833', '#ffd200'),
  k('michigan', 'Michigan', 'M', '#00274c', '#ffcb05'),
  k('michiganstate', 'Michigan State', 'S', '#18453b', '#f4f1e8'),
  k('minnesota', 'Minnesota', 'M', '#7a0019', '#ffcc33'),
  k('nebraska', 'Nebraska', 'N', '#e41c38', '#f4f1e8'),
  k('northwestern', 'Northwestern', 'N', '#4e2a84', '#f4f1e8'),
  k('ohiostate', 'Ohio State', 'OSU', '#bb0000', '#a7b1b7'),
  k('oregon', 'Oregon', 'O', '#154733', '#fee123'),
  k('pennstate', 'Penn State', 'PSU', '#041e42', '#f4f1e8'),
  k('purdue', 'Purdue', 'P', '#111111', '#cfb991'),
  k('rutgers', 'Rutgers', 'R', '#cc0033', '#f4f1e8'),
  k('ucla', 'UCLA', 'UCLA', '#2d68c4', '#f2a900'),
  k('usc', 'USC', 'SC', '#990000', '#ffc72c'),
  k('washington', 'Washington', 'W', '#4b2e83', '#b7a57a'),
  k('wisconsin', 'Wisconsin', 'W', '#c5050c', '#f4f1e8'),
  // ACC
  k('bc', 'Boston College', 'BC', '#8a100b', '#bc9b6a'),
  k('cal', 'California', 'CAL', '#003262', '#fdb515'),
  k('clemson', 'Clemson', 'C', '#f56600', '#522d80'),
  k('duke', 'Duke', 'D', '#003087', '#f4f1e8'),
  k('fsu', 'Florida State', 'FSU', '#782f40', '#ceb888'),
  k('gatech', 'Georgia Tech', 'GT', '#003057', '#b3a369'),
  k('louisville', 'Louisville', 'L', '#ad0000', '#111111'),
  k('miami', 'Miami', 'U', '#005030', '#f47321'),
  k('unc', 'North Carolina', 'NC', '#7bafd4', '#13294b'),
  k('ncstate', 'NC State', 'NCS', '#cc0000', '#f4f1e8'),
  k('notredame', 'Notre Dame', 'ND', '#0c2340', '#c99700'),
  k('pitt', 'Pittsburgh', 'PITT', '#003594', '#ffb81c'),
  k('smu', 'SMU', 'SMU', '#0033a0', '#c8102e'),
  k('stanford', 'Stanford', 'S', '#8c1515', '#f4f1e8'),
  k('syracuse', 'Syracuse', 'S', '#f76900', '#000e54'),
  k('uva', 'Virginia', 'V', '#232d4b', '#e57200'),
  k('vt', 'Virginia Tech', 'VT', '#630031', '#cf4420'),
  k('wakeforest', 'Wake Forest', 'WF', '#111111', '#9e7e38'),
  // Big 12
  k('arizona', 'Arizona', 'A', '#0c234b', '#ab0520'),
  k('asu', 'Arizona State', 'ASU', '#8c1d40', '#ffc627'),
  k('baylor', 'Baylor', 'BU', '#154734', '#ffb81c'),
  k('byu', 'BYU', 'Y', '#002e5d', '#f4f1e8'),
  k('cincinnati', 'Cincinnati', 'C', '#e00122', '#111111'),
  k('colorado', 'Colorado', 'CU', '#111111', '#cfb87c'),
  k('houston', 'Houston', 'UH', '#c8102e', '#f4f1e8'),
  k('iowastate', 'Iowa State', 'ISU', '#c8102e', '#f1be48'),
  k('kansas', 'Kansas', 'KU', '#0051ba', '#e8000d'),
  k('kstate', 'Kansas State', 'K', '#512888', '#f4f1e8'),
  k('okstate', 'Oklahoma State', 'OSU', '#ff7300', '#111111'),
  k('tcu', 'TCU', 'TCU', '#4d1979', '#f4f1e8'),
  k('texastech', 'Texas Tech', 'TT', '#cc0000', '#111111'),
  k('ucf', 'UCF', 'UCF', '#111111', '#ba9b37'),
  k('utah', 'Utah', 'U', '#cc0000', '#f4f1e8'),
  k('wvu', 'West Virginia', 'WV', '#002855', '#eaaa00'),
  // Ivy League and friends
  k('brown', 'Brown', 'B', '#4e3629', '#c00404'),
  k('columbia', 'Columbia', 'C', '#9bcbeb', '#1d4f91'),
  k('cornell', 'Cornell', 'C', '#b31b1b', '#f4f1e8'),
  k('dartmouth', 'Dartmouth', 'D', '#00693e', '#f4f1e8'),
  k('harvard', 'Harvard', 'H', '#a51c30', '#f4f1e8'),
  k('penn', 'Penn', 'P', '#011f5b', '#990000'),
  k('princeton', 'Princeton', 'P', '#111111', '#e77500'),
  k('yale', 'Yale', 'Y', '#00356b', '#f4f1e8'),
  k('chicago', 'Chicago', 'C', '#800000', '#f4f1e8'),
  k('georgetown', 'Georgetown', 'G', '#041e42', '#8d817b'),
  k('mit', 'MIT', 'MIT', '#a31f34', '#8a8b8c'),
  k('navy', 'Navy', 'N', '#00205b', '#c5b783'),
  k('army', 'Army', 'A', '#111111', '#d3bc8d'),
  k('airforce', 'Air Force', 'AF', '#003087', '#8a8d8f'),
  // more golf schools
  k('hawaii', 'Hawaii', 'H', '#024731', '#f4f1e8'),
  k('gonzaga', 'Gonzaga', 'G', '#041e42', '#c8102e'),
  k('villanova', 'Villanova', 'V', '#00205b', '#13b5ea'),
  k('sdsu', 'San Diego State', 'SD', '#a6192e', '#111111'),
  k('unlv', 'UNLV', 'UNLV', '#cf0a2c', '#8a8d8f'),
  k('pepperdine', 'Pepperdine', 'P', '#00205c', '#ee7623'),
  k('furman', 'Furman', 'F', '#582c83', '#f4f1e8'),
];

export const kitByKey = (key?: string) => (key ? KITS.find((x) => x.key === key) : undefined);

// A sheet over the page: search, then tap a school. Resolves with the kit, or null if closed.
export function pickKit(current?: string): Promise<Kit | null> {
  return new Promise((done) => {
    const el = document.createElement('div');
    el.className = 'kit-sheet';
    el.innerHTML = `
      <div class="kit-card" role="dialog" aria-label="Claim your fall kit">
        <div class="kit-head"><div><p class="eyebrow">The fall kit</p><h3>Pick your school</h3></div><button class="link" data-close aria-label="Close">✕</button></div>
        <input type="search" placeholder="Search schools" aria-label="Search schools" autocomplete="off">
        <div class="kit-list"></div>
      </div>`;
    const list = el.querySelector<HTMLElement>('.kit-list')!;
    const input = el.querySelector<HTMLInputElement>('input')!;
    const draw = (q: string) => {
      const n = q.trim().toLowerCase();
      const hits = KITS.filter((x) => !n || x.name.toLowerCase().includes(n) || x.mono.toLowerCase() === n);
      list.innerHTML = hits.length
        ? hits
            .map(
              (x) =>
                `<button class="kit-row ${x.key === current ? 'on' : ''}" data-kit="${x.key}"><span class="kit-mono" style="background:${x.primary};color:${x.secondary}">${esc(x.mono)}</span><span>${esc(x.name)}</span><i style="background:${x.secondary}"></i></button>`,
            )
            .join('')
        : `<p class="muted">No school by that name yet.</p>`;
    };
    draw('');
    const close = (kit: Kit | null) => {
      el.remove();
      done(kit);
    };
    input.addEventListener('input', () => draw(input.value));
    el.addEventListener('click', (e) => {
      const t = e.target as HTMLElement;
      if (t === el || t.closest('[data-close]')) return close(null);
      const row = t.closest<HTMLElement>('[data-kit]');
      if (row) close(kitByKey(row.dataset.kit) ?? null);
    });
    document.body.appendChild(el);
    input.focus({ preventScroll: true });
  });
}
