import React from 'react'
import {
	Table,
	Card,
	Typography,
	Spin,
	Alert,
	Button,
	Space,
	Popconfirm,
} from 'antd'
import { ReloadOutlined, DeleteOutlined } from '@ant-design/icons'
import { useGetUsersQuery } from '../store/api/userApi'
import AuthWrapper from '../components/Universal/AuthWrapper'
import FormButton from '../components/Universal/Button/Button'
import type { User } from '../types/user.types'

const { Title } = Typography

const Users: React.FC = () => {
	const { data: users, isLoading, error, refetch } = useGetUsersQuery()

	const columns = [
		{ title: 'ID', dataIndex: 'id', key: 'id', width: 80 },
		{ title: 'Логин', dataIndex: 'login', key: 'login' },
		{
			title: 'Действия',
			key: 'actions',
			width: 220,
			render: (_: unknown, record: User) => (
				<Space>
					<Popconfirm
						title='Удалить пользователя'
						description={`Удалить "${record.login}"?`}
						okText='Да'
						cancelText='Нет'
					>
						<Button type='link' danger icon={<DeleteOutlined />}>
							Удалить
						</Button>
					</Popconfirm>
				</Space>
			),
		},
	]

	return (
		<AuthWrapper>
			<Card>
				<div
					style={{
						display: 'flex',
						justifyContent: 'space-between',
						marginBottom: 16,
					}}
				>
					<Title level={4}>Список пользователей</Title>
					<FormButton
						title='Обновить'
						type='default'
						icon={<ReloadOutlined />}
						onClick={() => {
							refetch()
						}}
						loading={isLoading}
					/>
				</div>

				{isLoading && (
					<Spin
						size='large'
						style={{ display: 'block', margin: '40px auto' }}
					/>
				)}

				{error && (
					<Alert
						message='Не удалось загрузить пользователей'
						description={
							<pre style={{ margin: 0, fontSize: 12 }}>
								{JSON.stringify(
									error && 'data' in error ? error.data : error,
									null,
									2,
								)}
							</pre>
						}
						type='error'
						showIcon
						action={
							<Button size='small' onClick={() => refetch()}>
								Повторить
							</Button>
						}
					/>
				)}

				{!isLoading && !error && users && users.length > 0 && (
					<Table<User>
						dataSource={users}
						columns={columns}
						rowKey='id'
						pagination={{ pageSize: 10 }}
					/>
				)}

				{!isLoading && !error && (!users || users.length === 0) && (
					<Alert description='Пользователей пока нет' type='info' />
				)}
			</Card>
		</AuthWrapper>
	)
}

export default Users
