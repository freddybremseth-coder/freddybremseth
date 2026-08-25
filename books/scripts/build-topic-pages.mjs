import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const ORIGIN = process.env.SITE_URL || 'https://books.freddybremseth.com';
const dataJs = fs.readFileSync(path.join(root, 'assets/books-data.js'), 'utf8');
const json = dataJs.slice(dataJs.indexOf('['), dataJs.lastIndexOf(']') + 1);
const series = JSON.parse(json);
const langs = ['no','en','es'];
const esc = (v='') => String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pick = (v, lang) => typeof v === 'string' ? v : (v?.[lang] || v?.en || v?.no || v?.es || '');
const prefix = lang => lang === 'no' ? '' : `/${lang}`;

const topics = [
  {
    id: 'geopolitics-power',
    seriesIds: ['power-behind-curtain','hidden-systems-of-power'],
    title: {
      no: 'Bøker om geopolitikk, makt og verdensorden',
      en: 'Books on Geopolitics, Power and the World Order',
      es: 'Libros sobre geopolítica, poder y orden mundial'
    },
    desc: {
      no: 'Utforsk bøker om geopolitikk, strategiske ressurser, kapital, krig, energi, valuta, forsyningskjeder og de strukturelle systemene som former global makt.',
      en: 'Explore books on geopolitics, strategic resources, capital, war, energy, currency, supply chains and the structural systems that shape global power.',
      es: 'Explora libros sobre geopolítica, recursos estratégicos, capital, guerra, energía, divisas, cadenas de suministro y los sistemas estructurales que moldean el poder global.'
    }
  },
  {
    id: 'psychological-thrillers',
    seriesIds: ['michael-thorne','elias-holm'],
    title: {
      no: 'Psykologiske thrillere om identitet, skyld og makt',
      en: 'Psychological Thrillers about Identity, Guilt and Power',
      es: 'Thrillers psicológicos sobre identidad, culpa y poder'
    },
    desc: {
      no: 'Mørke thrillere og krimserier om identitet, moralsk ansvar, manipulering, institusjoner, skjulte systemer og mennesker som tvinges til å tvile på det de tror de vet.',
      en: 'Dark thrillers and crime series about identity, moral responsibility, manipulation, institutions, hidden systems and people forced to question what they think they know.',
      es: 'Thrillers oscuros y series criminales sobre identidad, responsabilidad moral, manipulación, instituciones, sistemas ocultos y personas obligadas a cuestionar lo que creen saber.'
    }
  },
  {
    id: 'money-economics',
    seriesIds: ['let-me-explain'],
    title: {
      no: 'Bøker om penger, økonomi, bank og finans',
      en: 'Books about Money, Economics, Banking and Finance',
      es: 'Libros sobre dinero, economía, banca y finanzas'
    },
    desc: {
      no: 'Klare forklaringer på hvordan penger, banker, kreditt, skatt, inflasjon, renter, gjeld og økonomiske insentiver faktisk fungerer.',
      en: 'Clear explanations of how money, banks, credit, taxes, inflation, interest rates, debt and economic incentives actually work.',
      es: 'Explicaciones claras de cómo funcionan realmente el dinero, los bancos, el crédito, los impuestos, la inflación, los tipos de interés, la deuda y los incentivos económicos.'
    }
  }
];

function abs(lang, route) { return `${ORIGIN}${prefix(lang)}/${route}`; }
function page(topic, lang) {
  const selected = series.filter(s => topic.seriesIds.includes(s.id));
  const books = selected.flatMap(s => (s.books || []).map(b => ({s,b})));
  const title = pick(topic.title, lang);
  const desc = pick(topic.desc, lang);
  const route = `topics/${topic.id}`;
  const items = books.map(({s,b}) => `<article><h2><a href="${prefix(lang)}/book/${esc(b.id)}">${esc(b.title)}</a></h2><p>${esc(pick(b.descShort, lang) || pick(b.descFull, lang))}</p><p><a href="${prefix(lang)}/series/${esc(s.id)}">${esc(pick(s.title, lang))}</a></p></article>`).join('');
  const related = selected.map(s => `<li><a href="${prefix(lang)}/series/${esc(s.id)}">${esc(pick(s.title, lang))}</a></li>`).join('');
  const schema = {
    '@context':'https://schema.org',
    '@type':'CollectionPage',
    name:title,
    description:desc,
    url:abs(lang, route),
    about:topic.id,
    author:{'@type':'Person',name:'Freddy Bremseth'},
    hasPart:books.map(({b}) => ({'@type':'Book',name:b.title,url:abs(lang,`book/${b.id}`)}))
  };
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Freddy Bremseth</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(abs(lang,route))}">${langs.map(l=>`<link rel="alternate" hreflang="${l}" href="${esc(abs(l,route))}">`).join('')}<link rel="alternate" hreflang="x-default" href="${esc(abs('no',route))}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script><link rel="stylesheet" href="/assets/books.css"></head><body><main style="max-width:1000px;margin:40px auto;padding:0 24px"><nav><a href="${prefix(lang)||'/'}">${lang==='en'?'Books':lang==='es'?'Libros':'Bøker'}</a> · <a href="${prefix(lang)}/library">${lang==='en'?'Library':lang==='es'?'Biblioteca':'Bibliotek'}</a></nav><h1>${esc(title)}</h1><p>${esc(desc)}</p><h2>${lang==='en'?'Related series':lang==='es'?'Series relacionadas':'Relaterte serier'}</h2><ul>${related}</ul>${items}</main></body></html>`;
}

for (const lang of langs) {
  for (const topic of topics) {
    const file = path.join(root, lang === 'no' ? '' : lang, `topics/${topic.id}.html`);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, page(topic, lang));
  }
}
console.log(`Prerendered ${topics.length * langs.length} topic pages.`);
