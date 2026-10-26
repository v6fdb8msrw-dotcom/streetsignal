import { Rail } from './components/Rail.tsx'
import { useRoute } from './lib/router.ts'
import { AddProperty } from './pages/AddProperty.tsx'
import { Compare } from './pages/Compare.tsx'
import { Developments } from './pages/Developments.tsx'
import { Explore } from './pages/Explore.tsx'
import { Landing } from './pages/Landing.tsx'
import { MyProperties } from './pages/MyProperties.tsx'
import { Overview } from './pages/Overview.tsx'
import { Sources } from './pages/Sources.tsx'

export default function App() {
  const route = useRoute()
  if (route.page === 'start') return <Landing />
  const content = (() => {
    switch (route.page) {
      case 'uebersicht':
        return <Overview />
      case 'umgebung':
        return <Explore route={route} />
      case 'hinzufuegen':
        return <AddProperty />
      case 'meine':
        return <MyProperties />
      case 'vergleich':
        return <Compare />
      case 'entwicklungen':
        return <Developments />
      case 'quellen':
        return <Sources />
    }
  })()
  const isMap = route.page === 'uebersicht' || route.page === 'umgebung'
  return (
    <div className="shell">
      <Rail current={route.page} />
      <main className={isMap ? 'main map-main' : 'main'}>
        <div key={route.page} className={`main-inner ${isMap ? '' : 'page-enter'}`}>
          {content}
        </div>
      </main>
    </div>
  )
}
