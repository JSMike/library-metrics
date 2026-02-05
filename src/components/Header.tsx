import { Link } from '@tanstack/react-router'

import './Header.scss'

export default function Header() {
  return (
    <header className="header">
      <nav className="nav">
        <div className="nav-item">
          <Link to="/">Dashboard</Link>
        </div>

        <div className="nav-item">
          <Link to="/libraries">Libraries</Link>
        </div>

        <div className="nav-item">
          <Link to="/projects">Projects</Link>
        </div>

        <div className="nav-item">
          <Link to="/queries">Queries</Link>
        </div>

        <div className="nav-item">
          <Link to="/reports">Reports</Link>
        </div>
      </nav>
    </header>
  )
}
