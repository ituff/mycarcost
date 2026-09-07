import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';
import { useVehicles } from '../hooks/useVehicles';
import ConsumptionForm from '../components/ConsumptionForm';

export default function ConsumptionEditPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { vehicles } = useVehicles();
  const [record, setRecord] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    api.getConsumption(id!)
      .then(setRecord)
      .catch((err) => setError(err?.error || '加载失败'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="text-center py-8 text-gray-400">加载中...</div>;
  if (error || !record) return <div className="text-center py-8 text-gray-400">{error || '记录不存在'}</div>;

  const vehicleType = vehicles.find((v) => v.id === record.vehicleId)?.type;

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">修改能耗记录</h1>
      <ConsumptionForm
        key={record.id}
        vehicleId={record.vehicleId}
        vehicleType={vehicleType}
        record={record}
        onSaved={() => navigate(`/consumptions/records/${id}`, { replace: true })}
        onCancel={() => navigate(`/consumptions/records/${id}`)}
      />
    </div>
  );
}
