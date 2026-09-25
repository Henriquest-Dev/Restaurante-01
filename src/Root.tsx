import { lazy, Suspense, useEffect, useState } from 'react'
import Home from './site/Home'

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
  useEffect(() => {
    document.documentElement.dataset.page = page
  }, [page])
  return (
    <Suspense fallback={<div className="route-loading" aria-label="A carregar" />}>
      {page === 'reservar' ? <Experience key="x" /> : page === 'menu' ? <MenuPage key="m" /> : <Home key="h" section={route} />}
    </Suspense>
  )
}
