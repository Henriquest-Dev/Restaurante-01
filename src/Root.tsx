import { lazy, Suspense, useEffect, useState } from 'react'
import { BOOKING, DISHES, EVENTS, HERO, REVIEWS, SPACE, STORY } from './site/content'
import { Curtain, preloadIdle } from './site/Curtain'
import Home from './site/Home'

const SITE_BASE = import.meta.env.BASE_URL + 'assets/site/'
const portrait = () => window.innerHeight > window.innerWidth
const CRITICAL = {
  home: () => [
    HERO.plate, SITE_BASE + 'splash.webp',
    ...[1, 2, 3, 4].map((n) => `${SITE_BASE}clouds/cloud-${n}.webp`),
    portrait() ? SPACE.doorTall : SPACE.door,
  ],
  menu: () => [SITE_BASE + 'splash.webp', ...DISHES.map((d) => d.image), ...DISHES.map((d) => d.image.replace('/plates/', '/plates/thumb/'))],
}
const LATER = () => [
  STORY.image, EVENTS.image, REVIEWS.image, BOOKING.image,
  ...DISHES.map((d) => d.image), ...DISHES.map((d) => d.image.replace('/plates/', '/plates/thumb/')),
  SITE_BASE + 'photos/bolonhesa.webp', SITE_BASE + 'photos/carbonara.webp', SITE_BASE + 'photos/bife.webp',
]

// The film experience and the menu load only when visited.
const Experience = lazy(() => import('./App'))
const MenuPage = lazy(() => import('./site/MenuPage'))

/** Routes: #/ (home, with #/sobre and #/eventos as sections), #/menu, #/reservar. */
function useRoute() {
  const read = () => location.hash.replace(/^#\/?/, '').split('?')[0]
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const on = () => setRoute(read())
    window.addEventListener('hashchange', on)
    return () => window.removeEventListener('hashchange', on)
  }, [])
  return route
}

export default function Root() {
  const route = useRoute()
  const page = route === 'reservar' ? 'reservar' : route === 'menu' ? 'menu' : 'home'
  // The curtain covers the first page load only (the film has its own).
  const [ready, setReady] = useState(page === 'reservar')
  const [critical] = useState(() => (page === 'reservar' ? [] : CRITICAL[page]()))
  useEffect(() => {
    document.documentElement.dataset.page = page
  }, [page])
  useEffect(() => {
    if (ready) preloadIdle(LATER())
  }, [ready])
  return (
    <>
      {page !== 'reservar' && critical.length > 0 && <Curtain urls={critical} onDone={() => setReady(true)} />}
      <Suspense fallback={<div className="route-loading" aria-label="A carregar" />}>
        {page === 'reservar' ? <Experience key="x" /> : !ready ? null : page === 'menu' ? <MenuPage key="m" /> : <Home key="h" section={route} />}
      </Suspense>
    </>
  )
}
