import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../api';

const fuelTypeLabels: Record<string, string> = { gasoline: '汽油', diesel: '柴油', electric: '电' };
const phaseLabels: Record<string, string> = { single: '单相', three: '三相' };

function Row({ label, value }: { label: string; value: any }) {
  if (value === null || value === undefined || value === '') return null;
  return (
    <div className="flex justify-between py-2 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm text-right font-medium">{value}</span>
    </div>
  );
}

export default function ConsumptionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

  const isElectric = record.fuelType === 'electric';
  const money = record.totalPrice != null ? record.totalPrice : record.unitPrice * record.quantity;

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-xl font-bold">能耗详情</h1>
        <button
          onClick={() => navigate(`/consumptions/records/${id}/edit`)}
          className="bg-blue-600 text-white rounded-lg px-4 min-h-[44px] text-sm"
        >
          修改
        </button>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
        <p className="font-semibold mb-1">
          {fuelTypeLabels[record.fuelType]} · {record.quantity.toFixed(2)}{isElectric ? ' kWh' : ' L'} · ¥{money.toFixed(2)}
        </p>
        <p className="text-xs text-gray-400">{record.vehicleName} · {record.recordTime?.slice(0, 16).replace('T', ' ')}</p>
      </div>

      <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
        <Row label="时间" value={record.recordTime?.slice(0, 16).replace('T', ' ')} />
        <Row label="累计里程" value={`${Number(record.mileage).toFixed(1)} km`} />
        <Row label="燃料类型" value={fuelTypeLabels[record.fuelType]} />
        <Row label={isElectric ? '充电量' : '加油量'} value={`${record.quantity.toFixed(2)} ${isElectric ? 'kWh' : 'L'}`} />
        <Row label="单价" value={`¥${Number(record.unitPrice).toFixed(3)} / ${isElectric ? 'kWh' : 'L'}`} />
        <Row label="总价" value={record.totalPrice != null ? `¥${Number(record.totalPrice).toFixed(2)}` : null} />
        <Row label="地点" value={record.locationName} />
        <Row label="备注" value={record.note} />
      </div>

      {isElectric && (
        <div className="bg-white rounded-lg p-4 shadow-sm mb-4">
          <p className="font-semibold mb-2">充电信息</p>
          <Row label="充电类型" value={record.chargingType === 'dc' ? '直流 (DC)' : record.chargingType === 'ac' ? '交流 (AC)' : null} />
          <Row label="电流相数" value={record.chargingPhase ? phaseLabels[record.chargingPhase] : null} />
          <Row label="充电电流" value={record.chargingCurrent != null ? `${record.chargingCurrent} A` : null} />
          <Row label="充电前电量" value={record.batteryBefore != null ? `${record.batteryBefore}%` : null} />
          <Row label="充电后电量" value={record.batteryAfter != null ? `${record.batteryAfter}%` : null} />
          <Row label="预计满电续航" value={record.estimatedRange != null ? `${record.estimatedRange} km` : null} />
          <Row label="剩余里程" value={record.remainingRangeKm != null ? `${record.remainingRangeKm} km` : null} />
          <Row label="车机显示能耗" value={record.displayConsumption != null ? `${record.displayConsumption} kWh/100km` : null} />
          <Row label="车机显示消耗" value={record.consumedKwh != null ? `${record.consumedKwh} kWh` : null} />
          <Row label="充满电表显里程" value={record.fullChargeRangeKm != null ? `${record.fullChargeRangeKm} km` : null} />
          <Row label="车辆显示充电电量" value={record.vehicleDisplayedKwh != null ? `${record.vehicleDisplayedKwh} kWh` : null} />
          <Row label="充电桩显示充电电量" value={record.chargerDisplayedKwh != null ? `${record.chargerDisplayedKwh} kWh` : null} />
          <Row label="充电站" value={record.chargingStation} />
        </div>
      )}

      {isElectric && record.electricityDetails?.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <p className="font-semibold mb-2">电量明细（峰谷电价）</p>
          {record.electricityDetails.map((d: any, i: number) => (
            <div key={d.id} className="flex justify-between py-2 border-b border-gray-50 last:border-0">
              <span className="text-sm text-gray-500">第 {i + 1} 组</span>
              <span className="text-sm font-medium">{d.quantity} kWh × ¥{d.unitPrice}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
