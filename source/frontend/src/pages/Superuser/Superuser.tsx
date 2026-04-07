import React, { useState } from 'react';
import { Card, Typography, Spin, Alert, Tabs, message } from 'antd';
import { UserOutlined, FileExcelOutlined } from '@ant-design/icons';

import { useGetUsersQuery, useUploadUsersExcelMutation } from '../../store/api/userApi';
import AuthWrapper from '../../components/Universal/AuthWrapper';
import FileUploadComponent from './FileUploadComponent';
import UserTableComponent from './UserTableComponent';
const { Title } = Typography;

const SuperuserPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [uploadResult, setUploadResult] = useState<{
    success: boolean;
    message: string;
    importedCount: number;
    failedCount: number;
  } | null>(null);

  const { data: users = [], isLoading, error, refetch } = useGetUsersQuery();
  const [uploadUsers, { isLoading: isUploading }] = useUploadUsersExcelMutation();

  const handleFileUpload = async (file: File) => {
    try {
      const result = await uploadUsers({ file }).unwrap();
      setUploadResult(result);
      message.success(result.message);
      
      if (result.success) {
        setTimeout(() => refetch(), 500);
      }
    } catch (err: any) {
      message.error(err?.data?.detail || 'Ошибка при загрузке файла');
    }
  };

  const tabItems = [
    {
      key: 'users',
      label: <span><UserOutlined /> Пользователи</span>,
      children: (
        <>
          {error && (
            <Alert
              message="Ошибка загрузки пользователей"
              description="Не удалось загрузить список пользователей. Попробуйте обновить страницу."
              type="error"
              showIcon
              style={{ marginBottom: 16 }}
            />
          )}
          {isLoading ? (
            <Spin size="large" style={{ display: 'block', margin: '40px auto' }} />
          ) : (
            <UserTableComponent users={users} />
          )}
        </>
      ),
    },
    {
      key: 'upload',
      label: <span><FileExcelOutlined /> Загрузка из Excel</span>,
      children: (
        <div style={{ maxWidth: 600, margin: '0 auto' }}>
          <Title level={4}>Загрузка пользователей из Excel</Title>
          <p style={{ marginBottom: 24, color: 'rgba(0, 0, 0, 0.45)' }}>
            Загрузите Excel файл со списком пользователей.
          </p>

          <FileUploadComponent onUpload={handleFileUpload} isLoading={isUploading} />

          {uploadResult && (
            <Alert
              message={uploadResult.success ? 'Успешно' : 'Ошибка'}
              description={
                <div>
                  <p>{uploadResult.message}</p>
                  <p>Импортировано: {uploadResult.importedCount}</p>
                  <p>Ошибок: {uploadResult.failedCount}</p>
                </div>
              }
              type={uploadResult.success ? 'success' : 'error'}
              showIcon
              style={{ marginTop: 24 }}
            />
          )}
        </div>
      ),
    },
  ];

  return (
    <AuthWrapper>
      <Card>
        <div style={{ marginBottom: 24 }}>
          <Title level={3} style={{ margin: 0 }}>Панель суперпользователя</Title>
        </div>

        <Tabs activeKey={activeTab} onChange={setActiveTab} items={tabItems} />

        <div style={{ marginTop: 24, fontSize: '12px', color: 'rgba(0, 0, 0, 0.45)' }}>
          <p>Всего пользователей: {users.length}</p>
        </div>
      </Card>
    </AuthWrapper>
  );
};

export default SuperuserPage;