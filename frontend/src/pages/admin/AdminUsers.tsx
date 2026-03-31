import { useAdminAuth } from '../../hooks/useAdminAuth'
import { getUsersStore, USER_ROLE_LABELS, type UserRole } from '../../data/users'
import './admin-common.css'
import './Users.css'

export default function AdminUsers() {
  const { user } = useAdminAuth()
  const users = getUsersStore()

  return (
    <div className="admin-users">
      <h1 className="admin-page-title">Admin users</h1>
      <p className="admin-page-subtitle">People who can access this admin panel.</p>
      <div className="admin-table-wrap">
        <table className="admin-table users-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Note</th>
            </tr>
          </thead>
          <tbody>
            {user && (
              <tr className="users-table-current">
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td>
                  <span className="admin-badge admin-badge--role-admin">
                    {USER_ROLE_LABELS[user.role as UserRole]}
                  </span>
                </td>
                <td className="users-table-note">Logged in</td>
              </tr>
            )}
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <span className="admin-badge admin-badge--role-admin">
                    {USER_ROLE_LABELS[u.role]}
                  </span>
                </td>
                <td className="users-table-note">—</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
