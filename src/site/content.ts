/**
 * Website content (pt-PT), in one place so the restaurant can edit it.
 *
 * Structure and copy follow the reference site supplied by the client.
 * Items marked EXEMPLO are sample content from that reference and must be
 * replaced with SALA's real details before launch: contacts, opening hours,
 * events, services and visitor testimonials.
 */

const BASE = import.meta.env.BASE_URL
const img = (p: string) => `${BASE}assets/site/${p}`

export const SITE = {
  name: 'SALA',
  city: 'Maputo, Moçambique',
  // EXEMPLO: replace with the real details.
  phone: '+258 00 000 0000',
  email: 'reservas@exemplo.com',
  hours: 'Seg. a Dom. · 9:00 – 23:00',
  social: { instagram: '#', facebook: '#', twitter: '#' },
}

export const NAV = [
  { label: 'Início', href: '#/' },
  { label: 'Sobre', href: '#/sobre' },
  { label: 'Menu', href: '#/menu' },
  { label: 'Eventos', href: '#/eventos' },
  { label: 'Reservas', href: '#/reservar' },
]

export const HERO = {
  lines: ['Bem-vindo', 'ao restaurante', 'SALA'],
  cta: 'Reservar',
  plate: img('plates/grelha.webp'),
}

export const SPACE = {
  title: 'A entrada',
  door: img('photos/entrada.webp'),
  doorTall: img('photos/entrada-m.webp'),
}

export const STORY = {
  kicker: 'Descubra',
  title: 'A nossa história',
  text:
    'A SALA não é apenas um restaurante: é um paraíso para o paladar, um prazer rodeado de natureza. ' +
    'Aqui vai sentir uma ligação inesquecível com a natureza, à volta da árvore que dá vida à sala.',
  link: 'Reservar mesa',
  image: img('photos/historia.webp'),
}

export const MENU_INTRO = {
  kicker: 'Descubra',
  title: 'O nosso menu',
  text:
    'A nossa equipa passou meses a investigar e a testar conceitos, ingredientes e receitas para chegar ao menu certo. ' +
    'Hoje reúne uma grande variedade de pratos, para que todos encontrem algo de que gostem.',
  groups: [
    {
      title: 'Pequenos-almoços fabulosos',
      text: 'Servidos durante todo o dia, para os verdadeiros apreciadores de pequenos-almoços tardios.',
      image: img('plates/horta.webp'),
    },
    {
      title: 'Jantares fantásticos',
      text: 'Com opções vegetarianas e não vegetarianas, para todos os gostos.',
      image: img('plates/caril.webp'),
    },
    {
      title: 'Petiscos divinais',
      text: 'Fruta fresca e legumes da horta, a acompanhar sabores feitos na casa.',
      image: img('plates/poke.webp'),
    },
  ],
  cta: 'Ver menu',
}

export const POPULAR = {
  kicker: 'Descubra',
  title: 'Os pratos mais pedidos',
  dishes: [
    {
      name: 'Bolonhesa',
      price: '',
      text: 'Massa italiana tradicional com um molho espesso de tomate e carne picada.',
      image: img('photos/bolonhesa.webp'),
    },
    {
      name: 'Carbonara',
      price: '',
      text: 'Com gema de ovo, bacon e queijo parmesão.',
      image: img('photos/carbonara.webp'),
    },
    {
      name: 'Bife grelhado',
      price: '',
      text: 'Servido com molho da casa, tomate e azeite de ervas.',
      image: img('photos/bife.webp'),
    },
  ],
}

export const SERVICES = {
  kicker: 'O que oferecemos',
  title: 'Os nossos serviços',
  text: 'O ambiente prepara o cenário. É mais do que uma sala de jantar longe de casa: a comida é a estrela, e os convidados também.',
  // EXEMPLO
  items: [
    { icon: 'events', label: 'Eventos' },
    { icon: 'menus', label: 'Menus especiais' },
    { icon: 'delivery', label: 'Entregas' },
  ] as const,
}

export const EVENTS = {
  kicker: 'Descubra',
  title: 'Próximos eventos',
  text:
    'Conheça pessoas interessantes ao som de música ao vivo e, claro, com a companhia de pratos incríveis — ' +
    'no nosso churrasco ou nas provas de novos pratos do chef.',
  // EXEMPLO
  event: { name: 'Noite de churrasco', date: '26 de julho', place: 'Sala tropical' },
  note: '(Novos eventos todos os fins de semana)',
  image: img('photos/eventos.webp'),
}

export const REVIEWS = {
  kicker: 'Saiba mais sobre',
  title: 'O que dizem os visitantes',
  // EXEMPLO: illustrative testimonials from the reference site.
  note: 'Testemunhos ilustrativos',
  image: img('photos/rececao.webp'),
  items: [
    { name: 'Angela', stars: 5, text: 'Jantei ontem neste sítio incrível e fiquei encantada. O interior é magnífico, tudo muito elegante e coerente. A equipa é atenciosa. Vamos voltar muitas vezes.' },
    { name: 'Maria', stars: 4, text: 'Adoro este lugar: é acolhedor, elegante e, acima de tudo, muito saboroso. Gosto muito da fruta e dos legumes frescos nos pratos, e dos cocktails.' },
    { name: 'André', stars: 5, text: 'Havia música agradável ao fundo e toda a equipa foi muito simpática. Serviço, comida, bebidas, sobremesas e ambiente: tudo o que se pode desejar.' },
    { name: 'Mónica', stars: 4, text: 'Excelente localização. Jantámos em família e todos ficaram muito satisfeitos. Um ambiente acolhedor e emoções difíceis de descrever. A comida é excelente.' },
  ],
}

export const BOOKING = {
  kicker: 'Reserva',
  title: 'Reserve a sua mesa',
  image: img('photos/mesa.webp'),
  experience: 'Entrar na SALA',
}

/* ------------------------------------------------------------------ menu */

export interface Dish {
  id: string
  line1: string
  line2: string
  category: string
  text: string
  ingredients: string[]
  image: string
  /** Accent colour of the arc and badge. */
  accent: string
}

export const DISHES: Dish[] = [
  {
    id: 'camarao',
    line1: 'Esparguete',
    line2: 'Camarão',
    category: 'Massas',
    text: 'Camarão salteado em alho e malagueta, tomate-cereja e salsa fresca, sobre esparguete al dente.',
    ingredients: ['Camarão', 'Esparguete', 'Tomate-cereja', 'Alho', 'Malagueta', 'Salsa'],
    image: img('plates/camarao.webp'),
    accent: '#e0a458',
  },
  {
    id: 'caril',
    line1: 'Caril de',
    line2: 'Salmão',
    category: 'Pratos principais',
    text: 'Salmão em molho cremoso de coco e especiarias, com limão e coentros.',
    ingredients: ['Salmão', 'Leite de coco', 'Caril', 'Limão', 'Coentros'],
    image: img('plates/caril.webp'),
    accent: '#efc25a',
  },
  {
    id: 'poke',
    line1: 'Taça',
    line2: 'Poke',
    category: 'Taças',
    text: 'Salmão grelhado em cubos, milho, pepino, couve roxa, tomate e ovo, numa taça fresca e colorida.',
    ingredients: ['Salmão', 'Milho', 'Pepino', 'Couve roxa', 'Tomate', 'Ovo'],
    image: img('plates/poke.webp'),
    accent: '#c9785a',
  },
  {
    id: 'horta',
    line1: 'Taça da',
    line2: 'Horta',
    category: 'Vegetariano',
    text: 'Abacate, grão, batata-doce assada, tomate, couve roxa e rabanete, com rebentos frescos.',
    ingredients: ['Abacate', 'Grão-de-bico', 'Batata-doce', 'Tomate', 'Couve roxa', 'Rabanete'],
    image: img('plates/horta.webp'),
    accent: '#a9b865',
  },
  {
    id: 'taca',
    line1: 'Quinoa',
    line2: 'Verde',
    category: 'Vegetariano',
    text: 'Quinoa com grão tostado, ervilha-torta, abacate, fruta da época e cebola roxa.',
    ingredients: ['Quinoa', 'Grão-de-bico', 'Ervilha-torta', 'Abacate', 'Cebola roxa'],
    image: img('plates/taca.webp'),
    accent: '#7fae98',
  },
  {
    id: 'grelha',
    line1: 'Bife na',
    line2: 'Frigideira',
    category: 'Grelhados',
    text: 'Bife grelhado em frigideira de ferro, com batatas assadas e pimentos padrón.',
    ingredients: ['Bife', 'Batata', 'Pimento padrón', 'Alho', 'Flor de sal'],
    image: img('plates/grelha.webp'),
    accent: '#b98a5e',
  },
]
