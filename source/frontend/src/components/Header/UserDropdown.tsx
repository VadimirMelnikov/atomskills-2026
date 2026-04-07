// UserDropdown.tsx
import { Avatar, Dropdown, type MenuProps, Modal, message } from 'antd'
import { Link, useNavigate } from 'react-router-dom'
import { UserOutlined, DownOutlined, LogoutOutlined } from '@ant-design/icons'
import { useLogoutMutation } from '../../store/api/userApi'

interface UserDropdownProps {
	fullName: string
	mesAm: number
	onLogout?: () => Promise<void> | void
	hideProfileLink?: boolean
}

export default function UserDropdown({
	fullName,
	onLogout,
	hideProfileLink = false,
}: UserDropdownProps) {
	const navigate = useNavigate()
	const [logout, { isLoading }] = useLogoutMutation()

	const handleLogout = () => {
		Modal.confirm({
			title: 'Выход из системы',
			content: 'Вы уверены, что хотите выйти?',
			okText: 'Да, выйти',
			cancelText: 'Отмена',
			onOk: async () => {
				try {
					// Вызываем logout mutation
					await logout().unwrap()
					await onLogout?.()

					// Очищаем localStorage/sessionStorage если есть
					localStorage.clear()
					sessionStorage.clear()
					
					// Показываем сообщение
					message.success('Вы успешно вышли из системы')
					
					// Перенаправляем на страницу auth
					navigate('/auth', { replace: true })
				} catch (error) {
					message.error('Ошибка при выходе из системы')
				}
			},
		})
	}

	const userMenuItems: MenuProps['items'] = hideProfileLink
		? [
				{
					key: 'logout',
					icon: <LogoutOutlined />,
					label: isLoading ? 'Выход...' : 'Выйти',
					onClick: handleLogout,
					disabled: isLoading,
				},
			]
		: [
				{
					key: 'profile',
					icon: <UserOutlined />,
					label: <Link to='/profile_true'>Мой профиль</Link>,
				},
				{
					key: 'divider',
					type: 'divider',
				},
				{
					key: 'logout',
					icon: <LogoutOutlined />,
					label: isLoading ? 'Выход...' : 'Выйти',
					onClick: handleLogout,
					disabled: isLoading,
				},
			]

	return (
		<Dropdown
			menu={{ items: userMenuItems }}
			trigger={['click']}
			className='user-dropdown'
		>
			<div className='header__user-profile'>
				<div className='header__user-info'>
					<div className='header__user-name'>{fullName}</div>
				</div>
				<Avatar
					size='default'
					icon={<UserOutlined />}
					className='header__avatar'
				/>
				<DownOutlined className='header__user-dropdown-icon' />
			</div>
		</Dropdown>
	)
}