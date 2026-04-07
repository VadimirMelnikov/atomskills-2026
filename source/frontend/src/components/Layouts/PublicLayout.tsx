import { type ReactNode } from 'react'
import { Layout } from 'antd'
import ShortFooter from '../Footer/ShortFooter'

const { Content } = Layout

interface PublicLayoutProps {
	children: ReactNode
}

export const PublicLayout = ({ children }: PublicLayoutProps) => {
	return (
		<Layout style={{ minHeight: '100vh', background: '#e6f7ff' }}>
			<Content style={{ padding: '24px', background: 'transparent' }}>
				<div
					style={{
						maxWidth: 1280,
						width: 'calc(100% - 24px)',
						margin: '12px auto',
						borderRadius: 14,
						background: '#ffffff',
						padding: 16,
						boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08)',
						border: '1px solid #e5e7eb',
						overscrollBehavior: 'contain',
					}}
				>
					{children}
				</div>
			</Content>
			<ShortFooter />
		</Layout>
	)
}
