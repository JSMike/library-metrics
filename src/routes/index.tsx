import { createFileRoute } from '@tanstack/react-router'
import { DashboardPage, dashboardLoader } from './dashboard'

export const Route = createFileRoute('/')({
  loader: dashboardLoader,
  component: HomeRoute,
})

function HomeRoute() {
  const data = Route.useLoaderData()
  return <DashboardPage {...data} />
}
