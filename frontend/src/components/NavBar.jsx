import { NavLink } from 'react-router-dom'

export default function NavBar() {
  return (
    <header className="navbar">
      <div className="navbar-brand">Orders Management</div>
      <nav className="navbar-links">
        <NavLink
          to="/clients"
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          Clients
        </NavLink>
        <NavLink
          to="/orders"
          className={({ isActive }) => (isActive ? 'active' : undefined)}
        >
          Orders
        </NavLink>
      </nav>
    </header>
  )
}
