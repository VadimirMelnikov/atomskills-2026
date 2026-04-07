import React, { useEffect, useState } from 'react';
import { Table, Button, Input, Select } from 'antd';
import {
  SearchOutlined,
  FilterOutlined,
  UserOutlined
} from '@ant-design/icons';
import type { User } from '../../types/user.types';
import type { ColumnsType, TableProps } from 'antd/es/table';

const { Search } = Input;
const { Option } = Select;

interface UserTableComponentProps {
  users: User[];
}

const UserTableComponent: React.FC<UserTableComponentProps> = ({ users }) => {
  const [searchText, setSearchText] = useState('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [pagination, setPagination] = useState<{ current: number; pageSize: number }>({ current: 1, pageSize: 10 });

  const deptLabel = (u: User) => u.department_title ?? u.department ?? null;
  const posLabel = (u: User) => u.position_name ?? u.position ?? null;

  // Получаем уникальные отделы и должности для фильтров
  const departments = [...new Set(users.map(deptLabel).filter(Boolean))] as string[];
  const positions = [...new Set(users.map(posLabel).filter(Boolean))] as string[];

  const getSexText = (sex: boolean | null) => {
    if (sex === true) return 'Мужской';
    if (sex === false) return 'Женский';
    return 'Не указан';
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = 
      (user.login || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (user.first_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (user.second_name || '').toLowerCase().includes(searchText.toLowerCase()) ||
      (user.surname || '').toLowerCase().includes(searchText.toLowerCase());
    
    const matchesDepartment = departmentFilter === 'all' || deptLabel(user) === departmentFilter;
    const matchesPosition = positionFilter === 'all' || posLabel(user) === positionFilter;
    
    return matchesSearch && matchesDepartment && matchesPosition;
  });

  useEffect(() => {
    // При изменении фильтров/поиска лучше возвращаться на первую страницу
    setPagination(prev => ({ ...prev, current: 1 }));
  }, [searchText, departmentFilter, positionFilter]);

  const columns: ColumnsType<User> = [
    {
      title: 'Таб. №',
      dataIndex: 'id',
      key: 'id',
      width: 100,
      sorter: (a, b) => {
        const idA = parseInt(a.id, 10) || 0;
        const idB = parseInt(b.id, 10) || 0;
        return idA - idB;
      },
    },
    {
      title: 'Логин',
      dataIndex: 'login',
      key: 'login',
      width: 120,
    },
    {
      title: 'ФИО',
      key: 'fullname',
      width: 200,
      render: (_, record) => (
        <div>
          <div style={{ fontWeight: 500 }}>
            {[record.surname, record.first_name, record.second_name].filter(Boolean).join(' ') || record.login}
          </div>
          <div style={{ fontSize: '12px', color: '#999' }}>
            <UserOutlined style={{ marginRight: 4 }} />
            {getSexText(record.sex)}
          </div>
        </div>
      ),
    },
    {
      title: 'Дата рождения',
      dataIndex: 'birth_date',
      key: 'birth_date',
      width: 110,
      render: (date) => date || '-',
      sorter: (a, b) => {
        if (!a.birth_date) return 1;
        if (!b.birth_date) return -1;
        return new Date(a.birth_date).getTime() - new Date(b.birth_date).getTime();
      },
    },
    {
      title: 'Отдел',
      key: 'department',
      width: 150,
      render: (_, record) => deptLabel(record) || '-',
    },
    {
      title: 'Должность',
      key: 'position',
      width: 150,
      render: (_, record) => posLabel(record) || '-',
    },
    {
      title: 'Руководитель',
      key: 'manager_id',
      width: 180,
      render: (_, record) => {
        if (record.manager_name) return record.manager_name;
        if (!record.manager_id) return '-';
        const manager = users.find(u => u.id === record.manager_id);
        return manager ? ([manager.surname, manager.first_name, manager.second_name].filter(Boolean).join(' ') || manager.login || manager.id) : record.manager_id;
      },
    },
  ];

  const tableProps: TableProps<User> = {
    columns,
    dataSource: filteredUsers.map(user => ({ ...user, key: user.id })),
    pagination: {
      current: pagination.current,
      pageSize: pagination.pageSize,
      showSizeChanger: true,
      showQuickJumper: true,
      pageSizeOptions: [10, 20, 30, 50],
      showTotal: (total, range) => `${range[0]}-${range[1]} из ${total} пользователей`,
      onChange: (page, pageSize) => {
        setPagination({ current: page, pageSize });
      },
    },
    scroll: { x: 980 },
    bordered: true,
    size: 'middle',
  };

  return (
    <div>
      <div style={{ marginBottom: 16, display: 'flex', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 300 }}>
          <Search
            placeholder="Поиск по логину, фамилии, имени, отчеству"
            allowClear
            enterButton={<SearchOutlined />}
            size="middle"
            value={searchText}
            onChange={(e) => setSearchText(e.target.value)}
            onSearch={(value) => setSearchText(value)}
          />
        </div>
        
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <FilterOutlined />
          <Select
            value={departmentFilter}
            onChange={setDepartmentFilter}
            style={{ width: 160 }}
            placeholder="Фильтр по отделу"
            allowClear
          >
            <Option value="all">Все отделы</Option>
            {departments.map(dept => (
              <Option key={dept} value={dept}>{dept}</Option>
            ))}
          </Select>
          
          <Select
            value={positionFilter}
            onChange={setPositionFilter}
            style={{ width: 160 }}
            placeholder="Фильтр по должности"
            allowClear
          >
            <Option value="all">Все должности</Option>
            {positions.map(pos => (
              <Option key={pos} value={pos}>{pos}</Option>
            ))}
          </Select>
          
          <Button
            onClick={() => {
              setSearchText('');
              setDepartmentFilter('all');
              setPositionFilter('all');
            }}
          >
            Сбросить фильтры
          </Button>
        </div>
      </div>

      <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ marginRight: 16 }}>
            Всего: <strong>{users.length}</strong>
          </span>
          <span>
            Отфильтровано: <strong>{filteredUsers.length}</strong>
          </span>
        </div>
      </div>

      <Table {...tableProps} />
    </div>
  );
};

export default UserTableComponent;