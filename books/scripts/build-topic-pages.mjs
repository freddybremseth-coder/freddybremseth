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
  },
  {
    id: 'mediterranean-living',
    seriesIds: ['mediterraneo-vital'],
    title: {
      no: 'Bøker om olivenolje, middelhavsliv og dyrking',
      en: 'Books about Olive Oil, Mediterranean Living and Growing',
      es: 'Libros sobre aceite de oliva, vida mediterránea y cultivo'
    },
    desc: {
      no: 'Utforsk bøker om olivenolje, polyfenoler, tidlig høsting, dyrking, mat, levetid og praktisk middelhavsliv.',
      en: 'Explore books about olive oil, polyphenols, early harvest, cultivation, food, longevity and practical Mediterranean living.',
      es: 'Explora libros sobre aceite de oliva, polifenoles, cosecha temprana, cultivo, alimentación, longevidad y vida mediterránea práctica.'
    }
  },
  {
    id: 'spain-costa-blanca',
    seriesIds: ['let-me-guide-you'],
    title: {
      no: 'Bøker og guider om Spania og Costa Blanca',
      en: 'Books and Guides about Spain and Costa Blanca',
      es: 'Libros y guías sobre España y Costa Blanca'
    },
    desc: {
      no: 'Guider til byer, områder, boligvalg og hverdagsliv i Spania, med særlig vekt på Costa Blanca.',
      en: 'Guides to towns, areas, property choices and everyday life in Spain, with a strong focus on Costa Blanca.',
      es: 'Guías sobre ciudades, zonas, vivienda y vida cotidiana en España, con especial atención a la Costa Blanca.'
    }
  },
  {
    id: 'health-balanced-life',
    seriesIds: ['balanced-life'],
    title: {
      no: 'Bøker om helse, tid, relasjoner og et balansert liv',
      en: 'Books about Health, Time, Relationships and a Balanced Life',
      es: 'Libros sobre salud, tiempo, relaciones y una vida equilibrada'
    },
    desc: {
      no: 'Personlige og praktiske bøker om tid, digitale vaner, relasjoner, livsvalg, farskap og hvordan hverdagen kan bli mer balansert.',
      en: 'Personal and practical books about time, digital habits, relationships, life choices, fatherhood and building a more balanced everyday life.',
      es: 'Libros personales y prácticos sobre tiempo, hábitos digitales, relaciones, decisiones de vida, paternidad y una vida cotidiana más equilibrada.'
    }
  },
  {
    id: 'childrens-books',
    seriesIds: ['victoria-andreas'],
    title: {
      no: 'Barnebøker for å se, peke og lære sammen',
      en: 'Children’s Books for Looking, Pointing and Learning Together',
      es: 'Libros infantiles para mirar, señalar y aprender juntos'
    },
    desc: {
      no: 'Enkle, visuelle barnebøker laget for små barn og voksne som vil se, peke, snakke og lære sammen.',
      en: 'Simple visual books for young children and adults who want to look, point, talk and learn together.',
      es: 'Libros visuales sencillos para niños pequeños y adultos que quieren mirar, señalar, hablar y aprender juntos.'
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
    '@graph':[
      {
        '@type':'CollectionPage',
        '@id':abs(lang, route)+'#page',
        name:title,
        description:desc,
        url:abs(lang, route),
        isPartOf:{'@id':ORIGIN+'/#website'},
        about:topic.id,
        author:{'@type':'Person','@id':'https://www.freddybremseth.com/#person',name:'Freddy Bremseth',url:'https://www.freddybremseth.com/'},
        mainEntity:{'@type':'ItemList',numberOfItems:books.length,itemListElement:books.map(({b},i)=>({'@type':'ListItem',position:i+1,name:b.title,url:abs(lang,`book/${b.id}`)}))}
      },
      {
        '@type':'BreadcrumbList',
        itemListElement:[
          {'@type':'ListItem',position:1,name:lang==='en'?'Books':lang==='es'?'Libros':'Bøker',item:ORIGIN+prefix(lang)+'/'},
          {'@type':'ListItem',position:2,name:title,item:abs(lang, route)}
        ]
      }
    ]
  };
  return `<!DOCTYPE html><html lang="${lang}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)} | Freddy Bremseth</title><meta name="description" content="${esc(desc)}"><link rel="canonical" href="${esc(abs(lang,route))}">${langs.map(l=>`<link rel="alternate" hreflang="${l}" href="${esc(abs(l,route))}">`).join('')}<link rel="alternate" hreflang="x-default" href="${esc(abs('no',route))}"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:type" content="website"><script type="application/ld+json">${JSON.stringify(schema).replace(/</g,'\\u003c')}</script><link rel="stylesheet" href="/assets/books.css"></head><body><main style="max-width:1000px;margin:40px auto;padding:0 24px"><nav><a href="${prefix(lang)||'/'}">${lang==='en'?'Books':lang==='es'?'Libros':'Bøker'}</a> · <a href="${prefix(lang)}/library">${lang==='en'?'Library':lang==='es'?'Biblioteca':'Bibliotek'}</a> · <a href="https://www.freddybremseth.com/">Freddy Bremseth</a></nav><h1>${esc(title)}</h1><p>${esc(desc)}</p><p><a href="${prefix(lang)}/library">${lang==='en'?'Browse the full library':lang==='es'?'Ver toda la biblioteca':'Se hele biblioteket'} →</a></p><h2>${lang==='en'?'Related series':lang==='es'?'Series relacionadas':'Relaterte serier'}</h2><ul>${related}</ul>${items}</main><script src="/assets/books-growth.js"></script><script defer src="/assets/seo-referral-tracker.js"></script></body></html>`;
}

for (const lang of langs) {
  for (const topic of topics) {
    const file = path.join(root, lang === 'no' ? '' : lang, `topics/${topic.id}.html`);
    fs.mkdirSync(path.dirname(file), {recursive:true});
    fs.writeFileSync(file, page(topic, lang));
  }
}
console.log(`Prerendered ${topics.length * langs.length} topic pages.`);
