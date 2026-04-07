import React from 'react'
import { Form, Input, Button, Card, message, Typography } from 'antd'
import type { FormProps } from 'antd'
import { UserOutlined } from '@ant-design/icons'
import { useNavigate } from 'react-router-dom'
import { useLoginMutation, userApi } from '../../store/api/userApi'
import type { AuthRequest } from '../../types/auth.interface'
import { store } from '../../store'

const { Title } = Typography

type LoginValues = AuthRequest

const Auth: React.FC = () => {

	const [form] = Form.useForm<LoginValues>()


	const [login, { isLoading }] = useLoginMutation()
	const navigate = useNavigate()

	const handleSubmit: FormProps<LoginValues>['onFinish'] = async values => {
		try {
			await login(values).unwrap()
			message.success('Вход успешен!')
			navigate('/files/my', { replace: true })
			const meReq = store.dispatch(
				userApi.endpoints.getCurrentUser.initiate(undefined, { forceRefetch: true }),
			)
			try {
				const me = await meReq.unwrap()
				navigate(me.is_superuser ? '/superuser' : '/files/shared', { replace: true })
			} finally {
				meReq.unsubscribe()
			}
		} catch (error: unknown) {
			message.error('Ошибка входа')
		}
	}

	return (
		<div
			style={{
				minHeight: '100vh',
				display: 'flex',
				alignItems: 'center',
				justifyContent: 'center',
				background: '#f0f2f5',
				padding: 20,
			}}
		>
			<Card
				style={{
					width: '100%',
					maxWidth: 360,
					border: 'none',
					boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
					borderRadius: 16,
				}}
			>
				<div style={{ textAlign: 'center', marginBottom: 32 }}>
					<UserOutlined
						style={{ fontSize: 40, color: '#1890ff', marginBottom: 16 }}
					/>
					<Title level={4} style={{ margin: 0 }}>
						Вход
					</Title>
				</div>

				{}
				<Form
					form={form}
					layout='vertical'
					size='large'
					onFinish={handleSubmit}
				>
					<Form.Item name='name' rules={[{ required: true }]}>
						<Input
							prefix={<UserOutlined style={{ color: '#bfbfbf' }} />}
							placeholder='Имя пользователя'
							style={{
								borderRadius: 12,
								border: '2px solid #f0f0f0',
							}}
						/>
					</Form.Item>

					<Form.Item style={{ marginBottom: 0 }}>
						<Button
							type='primary'
							htmlType='submit'
							block
							size='large'
							loading={isLoading}
							style={{
								borderRadius: 12,
								height: 48,
								background: '#1890ff',
								fontWeight: 600,
							}}
						>
							Войти →
						</Button>
					</Form.Item>
				</Form>
			</Card>
		</div>
	)
}

export default Auth
