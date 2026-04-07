import { type ReactNode } from 'react'
import { Layout } from 'antd'
import { Navigate, useLocation } from 'react-router-dom'
import Header from '../Header/Header'
import ShortFooter from '../Footer/ShortFooter'
import { useAuth } from '../../hooks/useAuth'

const { Content } = Layout

interface PrivateLayoutProps {
	children: ReactNode
}

export const PrivateLayout = ({ children }: PrivateLayoutProps) => {
	const { user, isRestoring, isLoading } = useAuth()
	const location = useLocation()

	if (!isRestoring && !isLoading && user?.is_superuser && location.pathname !== '/superuser') {
		return <Navigate to='/superuser' replace />
	}

	return (
<Layout style={{ minHeight: '100vh', background: '#e6f7ff' }}>
  <Header
    variant='rounded'
    showLogo={true}
    showUserAvatar={true}
    hideProfileLink={Boolean(user?.is_superuser)}
    logoTo={user?.is_superuser ? '/superuser' : '/'}
  />
  <Content style={{ padding: '12px 50px', background: 'transparent' }}>
    <div
      style={{
        maxWidth: 1280,
        width: 'calc(100% - 24px)',
        margin: '12px auto',
        borderRadius: 14,
        background: '#ffffff',
        boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
        minHeight: 'calc(100vh - 140px)',
      }}
    >
      {children}
    </div>
  </Content>
  <ShortFooter />
</Layout>
	)
}
