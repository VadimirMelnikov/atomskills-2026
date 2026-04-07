import React, { useState, useCallback } from 'react';
import { Upload, Button, Card, Typography, Progress, Alert } from 'antd';
import { UploadOutlined, FileExcelOutlined } from '@ant-design/icons';
import type { UploadFile, UploadProps } from 'antd';

const { Text } = Typography;

interface FileUploadComponentProps {
  onUpload: (file: File) => Promise<void>;
  isLoading?: boolean;
  acceptedFileTypes?: string[];
  maxFileSizeMB?: number;
}

const FileUploadComponent: React.FC<FileUploadComponentProps> = ({
  onUpload,
  isLoading = false,
  acceptedFileTypes = ['.xlsx'],
  maxFileSizeMB = 10,
}) => {
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const beforeUpload = useCallback((file: File) => {
    const fileExtension = file.name.slice(file.name.lastIndexOf('.')).toLowerCase();
    const isAcceptedType = acceptedFileTypes.some(type => 
      type.startsWith('.') ? fileExtension === type : file.type.includes(type)
    );

    if (!isAcceptedType) {
      setErrorMessage(`Неподдерживаемый формат. Разрешены: ${acceptedFileTypes.join(', ')}`);
      return false;
    }

    const maxSizeBytes = maxFileSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      setErrorMessage(`Файл слишком большой. Максимум: ${maxFileSizeMB}MB`);
      return false;
    }

    setErrorMessage('');
    return true;
  }, [acceptedFileTypes, maxFileSizeMB]);

  const handleUpload = async () => {
    if (fileList.length === 0) {
      setErrorMessage('Выберите файл для загрузки');
      return;
    }

    const file = fileList[0].originFileObj as File;
    if (!beforeUpload(file)) return;

    setUploadStatus('uploading');
    setUploadProgress(30);

    try {
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev >= 90 ? 90 : prev + 10);
      }, 200);

      await onUpload(file);
      clearInterval(progressInterval);
      
      setUploadProgress(100);
      setUploadStatus('success');

      setTimeout(() => {
        setFileList([]);
        setUploadProgress(0);
        setUploadStatus('idle');
      }, 2000);
    } catch (error) {
      setUploadStatus('error');
      setErrorMessage('Ошибка при загрузке файла');
    }
  };

  const uploadProps: UploadProps = {
    onRemove: () => {
      setFileList([]);
      setUploadStatus('idle');
      setErrorMessage('');
    },
    beforeUpload: (file) => {
      setFileList([{ uid: '-1', name: file.name, status: 'done', originFileObj: file }]);
      return false;
    },
    fileList,
    maxCount: 1,
    accept: acceptedFileTypes.join(','),
  };

  return (
    <Card>
      <div style={{ textAlign: 'center', marginBottom: 24 }}>
        <Text strong style={{ display: 'block', marginBottom: 8 }}>
          Загрузите Excel файл
        </Text>
        <Text type="secondary">
          {acceptedFileTypes.join(', ')} до {maxFileSizeMB}MB
        </Text>
      </div>

      <Upload.Dragger {...uploadProps} style={{ marginBottom: 24 }}>
        <p className="ant-upload-drag-icon"><UploadOutlined /></p>
        <p className="ant-upload-text">Нажмите или перетащите файл</p>
      </Upload.Dragger>

      {fileList.length > 0 && (
        <div style={{ marginBottom: 24, padding: 12, backgroundColor: '#fafafa', borderRadius: 4 }}>
          <FileExcelOutlined style={{ marginRight: 8, color: '#52c41a' }} />
          <Text>{fileList[0].name}</Text>
        </div>
      )}

      {uploadStatus === 'uploading' && (
        <div style={{ marginBottom: 24 }}>
          <Text strong>Загрузка...</Text>
          <Progress percent={uploadProgress} status="active" />
        </div>
      )}

      {uploadStatus === 'success' && (
        <Alert message="Файл успешно загружен" type="success" showIcon style={{ marginBottom: 24 }} />
      )}

      {errorMessage && (
        <Alert message="Ошибка" description={errorMessage} type="error" showIcon style={{ marginBottom: 24 }} />
      )}

      <Button
        type="primary"
        size="large"
        onClick={handleUpload}
        loading={isLoading || uploadStatus === 'uploading'}
        disabled={fileList.length === 0 || uploadStatus === 'uploading'}
        block
      >
        {uploadStatus === 'uploading' ? 'Загрузка...' : 'Загрузить'}
      </Button>
    </Card>
  );
};

export default FileUploadComponent;