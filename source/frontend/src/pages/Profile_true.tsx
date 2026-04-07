import React from 'react'
import { Alert, Button, Grid, Skeleton } from 'antd'
import AuthWrapper from '../components/Universal/AuthWrapper'
import { useGetCurrentUserQuery } from '../store/api/userApi'
import type { User } from '../types/user.types'

function formatBirthDate(iso: string | null | undefined): string {
	if (!iso) return '—'
	const d = new Date(iso)
	if (Number.isNaN(d.getTime())) return '—'
	return d.toLocaleDateString('ru-RU', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
	})
}

function displayFullName(user: User): string {
	if (user.name?.trim()) return user.name.trim()
	const parts = [user.surname, user.first_name, user.second_name].filter(Boolean)
	return parts.length > 0 ? parts.join(' ') : user.login
}

function pickPosition(u: User): string {
	const v = u.position_name ?? u.position
	return v?.trim() ? v : '—'
}

function pickDepartment(u: User): string {
	const v = u.department_title ?? u.department
	return v?.trim() ? v : '—'
}

const labelStyle: React.CSSProperties = {
	fontSize: 11,
	textTransform: 'uppercase',
	letterSpacing: '0.08em',
	color: '#64748b',
	marginBottom: 6,
	fontWeight: 600,
}

const Profile_true: React.FC = () => {
	const screens = Grid.useBreakpoint()
	const twoCols = Boolean(screens.md)
	const { data: user, isLoading, isError, error, refetch, isFetching } =
		useGetCurrentUserQuery()

	return (
		<AuthWrapper>
			<div style={{ padding: '28px 36px 40px', maxWidth: 900 }}>
				<h1
					style={{
						margin: '0 0 28px',
						fontSize: 22,
						fontWeight: 700,
						color: '#0f172a',
						letterSpacing: '-0.02em',
					}}
				>
					Мой профиль
				</h1>

				<div
					style={{
						borderRadius: 12,
						border: '1px solid rgba(148, 163, 184, 0.35)',
						boxShadow: '0 4px 24px rgba(15, 23, 42, 0.06)',
						background: '#fff',
						padding: '32px 36px',
					}}
				>
					{isLoading && (
						<Skeleton active paragraph={{ rows: 5 }} title={{ width: '40%' }} />
					)}

					{isError && (
						<Alert
							type='error'
							showIcon
							message='Не удалось загрузить профиль'
							description={
								error && 'data' in error
									? JSON.stringify(error.data)
									: 'Проверьте подключение и попробуйте снова.'
							}
							action={
								<Button size='small' onClick={() => refetch()} loading={isFetching}>
									Повторить
								</Button>
							}
						/>
					)}

					{!isLoading && !isError && user && (
						<div
							style={{
								display: 'grid',
								gridTemplateColumns: twoCols
									? 'minmax(0, 1fr) minmax(0, 1fr)'
									: '1fr',
								columnGap: 48,
								rowGap: 22,
								alignItems: 'start',
							}}
						>
							<div>
								<div style={labelStyle}>Табельный номер</div>
								<div
									style={{
										fontSize: 13,
										color: '#475569',
										fontVariantNumeric: 'tabular-nums',
									}}
								>
									{user.id}
								</div>
							</div>
							{twoCols ? <div /> : null}

							<div>
								<div style={{ ...labelStyle, marginBottom: 8 }}>ФИО</div>
								<div
									style={{
										fontSize: twoCols ? 26 : 22,
										fontWeight: 700,
										color: '#0f172a',
										lineHeight: 1.25,
										letterSpacing: '-0.02em',
									}}
								>
									{displayFullName(user)}
								</div>
							</div>
							<div>
								<div style={labelStyle}>Отдел</div>
								<div style={{ fontSize: 15, color: '#1e293b', lineHeight: 1.45 }}>
									{pickDepartment(user)}
								</div>
							</div>

							<div>
								<div style={labelStyle}>Дата рождения</div>
								<div style={{ fontSize: 15, color: '#1e293b' }}>
									{formatBirthDate(user.birth_date)}
								</div>
							</div>
							<div>
								<div style={labelStyle}>Руководитель</div>
								<div style={{ fontSize: 15, color: '#1e293b', lineHeight: 1.45 }}>
									{user.manager_name?.trim() ? user.manager_name : '—'}
								</div>
							</div>

							<div>
								<div style={labelStyle}>Должность</div>
								<div style={{ fontSize: 15, color: '#1e293b', lineHeight: 1.45 }}>
									{pickPosition(user)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>
		</AuthWrapper>
	)
}

export default Profile_true
