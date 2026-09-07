import { useVehicles } from '../hooks/useVehicles';

interface Props {
  selectedVehicleId: string | null;
  onSelect: (id: string) => void;
}

const typeLabels: Record<string, string> = {
  fuel: '燃油',
  electric: '电动',
  hybrid: '混动',
};

export default function VehicleSwitcher({ selectedVehicleId, onSelect }: Props) {
  const { vehicles, loading } = useVehicles();

  if (loading) {
    return <div className="text-sm text-gray-400">加载中...</div>;
  }

  if (vehicles.length === 0) {
    return <div className="text-sm text-gray-400">请先添加车辆</div>;
  }

  return (
    <select
      value={selectedVehicleId || ''}
      onChange={(e) => onSelect(e.target.value)}
      className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white min-h-[44px]"
      aria-label="选择车辆"
    >
      <option value="" disabled>选择车辆</option>
      {vehicles.map((v) => (
        <option key={v.id} value={v.id}>
          {v.name} ({typeLabels[v.type] || v.type})
        </option>
      ))}
    </select>
  );
}
