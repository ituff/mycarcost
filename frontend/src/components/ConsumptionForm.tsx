import { useState, useEffect } from 'react';
import { api } from '../api';

interface Props {
  vehicleId: string;
  vehicleType?: string;
  record?: any;
  onSaved: () => void;
  onCancel: () => void;
}

export default function ConsumptionForm({ vehicleId, vehicleType, record, onSaved, onCancel }: Props) {
  const [recordTime, setRecordTime] = useState(record?.recordTime?.slice(0, 16) || new Date().toISOString().slice(0, 16));
  const [mileage, setMileage] = useState(record?.mileage?.toString() || '');
  const [fuelType, setFuelType] = useState(record?.fuelType || (vehicleType === 'electric' ? 'electric' : 'gasoline'));
  const [quantity, setQuantity] = useState(record?.quantity?.toString() || '');
  const [unitPrice, setUnitPrice] = useState(record?.unitPrice?.toString() || '');
  const [totalPrice, setTotalPrice] = useState(record?.totalPrice?.toString() || '');
  const [priceMode, setPriceMode] = useState<'unit' | 'total'>(record?.totalPrice ? 'total' : 'unit');
  const [batteryBefore, setBatteryBefore] = useState(record?.batteryBefore?.toString() || '');
  const [batteryAfter, setBatteryAfter] = useState(record?.batteryAfter?.toString() || '');
  const [chargingType, setChargingType] = useState(record?.chargingType || '');
  const [chargingCurrent, setChargingCurrent] = useState(record?.chargingCurrent?.toString() || '');
  const [chargingPhase, setChargingPhase] = useState(record?.chargingPhase || 'single');
  const [chargingStation, setChargingStation] = useState(record?.chargingStation || '');
  const [stationOptions, setStationOptions] = useState<string[]>([]);
  const [estimatedRange, setEstimatedRange] = useState(record?.estimatedRange?.toString() || '');
  const [remainingRangeKm, setRemainingRangeKm] = useState(record?.remainingRangeKm?.toString() || '');
  const [displayConsumption, setDisplayConsumption] = useState(record?.displayConsumption?.toString() || '');
  const [consumedKwh, setConsumedKwh] = useState(record?.consumedKwh?.toString() || '');
  const [fullChargeRangeKm, setFullChargeRangeKm] = useState(record?.fullChargeRangeKm?.toString() || '');
  const [vehicleDisplayedKwh, setVehicleDisplayedKwh] = useState(record?.vehicleDisplayedKwh?.toString() || '');
  const [chargerDisplayedKwh, setChargerDisplayedKwh] = useState(record?.chargerDisplayedKwh?.toString() || '');
  const [note, setNote] = useState(record?.note || '');
  const [electricityDetails, setElectricityDetails] = useState<{ quantity: string; unitPrice: string }[]>(
    record?.electricityDetails?.map((d: any) => ({ quantity: d.quantity.toString(), unitPrice: d.unitPrice.toString() })) || [{ quantity: '', unitPrice: '' }]
  );
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Historical charging station names for quick-select (electric only)
  useEffect(() => {
    if (fuelType !== 'electric') return;
    api.getChargingStations().then((res) => setStationOptions(res.stations)).catch(() => {});
  }, [fuelType]);

  // Image recognition
  const [recognizing, setRecognizing] = useState(false);

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setRecognizing(true);
    try {
      const result = await api.recognizeImage(file);
      if (result.batteryBefore !== null) setBatteryBefore(String(result.batteryBefore));
      if (result.batteryAfter !== null) setBatteryAfter(String(result.batteryAfter));
      if (result.totalMileage !== null) setMileage(String(result.totalMileage));
    } catch (err: any) {
      alert(err.error || '图片识别失败');
    } finally {
      setRecognizing(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    const data: any = {
      recordTime,
      mileage: parseFloat(mileage),
      fuelType,
      quantity: parseFloat(quantity),
    };

    if (priceMode === 'unit') {
      data.unitPrice = parseFloat(unitPrice);
    } else {
      data.totalPrice = parseFloat(totalPrice);
    }

    if (fuelType === 'electric') {
      data.batteryBefore = parseInt(batteryBefore);
      data.batteryAfter = parseInt(batteryAfter);
      data.chargingPhase = chargingPhase;
      if (chargingType) data.chargingType = chargingType;
      if (chargingCurrent) data.chargingCurrent = parseFloat(chargingCurrent);
      if (chargingStation.trim()) data.chargingStation = chargingStation.trim();
      if (estimatedRange) data.estimatedRange = parseFloat(estimatedRange);
      if (remainingRangeKm) data.remainingRangeKm = parseFloat(remainingRangeKm);
      if (displayConsumption) data.displayConsumption = parseFloat(displayConsumption);
      if (consumedKwh) data.consumedKwh = parseFloat(consumedKwh);
      if (fullChargeRangeKm) data.fullChargeRangeKm = parseFloat(fullChargeRangeKm);
      if (vehicleDisplayedKwh) data.vehicleDisplayedKwh = parseFloat(vehicleDisplayedKwh);
      if (chargerDisplayedKwh) data.chargerDisplayedKwh = parseFloat(chargerDisplayedKwh);
      data.electricityDetails = electricityDetails.map((d) => ({
        quantity: parseFloat(d.quantity),
        unitPrice: parseFloat(d.unitPrice),
      }));
    }
    if (note.trim()) data.note = note.trim();

    try {
      if (record) {
        await api.updateConsumption(record.id, data);
      } else {
        await api.createConsumption(vehicleId, data);
      }
      onSaved();
    } catch (err: any) {
      setError(err.error || '保存失败');
    } finally {
      setSubmitting(false);
    }
  };

  const addElectricityDetail = () => {
    if (electricityDetails.length < 10) {
      setElectricityDetails([...electricityDetails, { quantity: '', unitPrice: '' }]);
    }
  };

  const removeElectricityDetail = (index: number) => {
    if (electricityDetails.length > 1) {
      setElectricityDetails(electricityDetails.filter((_, i) => i !== index));
    }
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg p-4 mb-4 shadow-sm space-y-3">
      <h2 className="font-semibold">{record ? '编辑能耗记录' : '添加能耗记录'}</h2>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="cf-time" className="block text-sm text-gray-600 mb-1">时间</label>
          <input id="cf-time" type="datetime-local" value={recordTime} onChange={(e) => setRecordTime(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
        </div>
        <div>
          <label htmlFor="cf-mileage" className="block text-sm text-gray-600 mb-1">里程 (km)</label>
          <input id="cf-mileage" type="number" step="0.1" value={mileage} onChange={(e) => setMileage(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
        </div>
      </div>

      <div>
        <label htmlFor="cf-fuelType" className="block text-sm text-gray-600 mb-1">燃料类型</label>
        <select id="cf-fuelType" value={fuelType} onChange={(e) => setFuelType(e.target.value)}
          className="w-full border rounded-lg px-3 py-2 min-h-[44px]">
          {vehicleType !== 'electric' && <option value="gasoline">汽油</option>}
          {vehicleType !== 'electric' && <option value="diesel">柴油</option>}
          {(vehicleType === 'electric' || vehicleType === 'hybrid' || !vehicleType) && <option value="electric">电</option>}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <div className="flex items-center h-5 mb-1">
            <label htmlFor="cf-quantity" className="text-sm text-gray-600">
              加注量 ({fuelType === 'electric' ? 'kWh' : 'L'})
            </label>
          </div>
          <input id="cf-quantity" type="number" step="0.01" value={quantity} onChange={(e) => setQuantity(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
        </div>
        <div>
          <div className="flex items-center gap-2 h-5 mb-1">
            <label className="text-sm text-gray-600">{priceMode === 'unit' ? '单价' : '总价'}</label>
            <button type="button" className="text-xs text-blue-600 underline"
              onClick={() => setPriceMode(priceMode === 'unit' ? 'total' : 'unit')}>
              切换到{priceMode === 'unit' ? '总价' : '单价'}
            </button>
          </div>
          {priceMode === 'unit' ? (
            <input type="number" step="0.001" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder={fuelType === 'electric' ? '元/kWh' : '元/L'} required />
          ) : (
            <input type="number" step="0.01" value={totalPrice} onChange={(e) => setTotalPrice(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="总金额" required />
          )}
        </div>
      </div>

      {/* Electric-specific fields */}
      {fuelType === 'electric' && (
        <div className="border-t pt-3 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-gray-700">充电信息</span>
            <label className="text-xs text-blue-600 cursor-pointer min-h-[44px] flex items-center">
              {recognizing ? '识别中...' : '📷 图片识别'}
              <input type="file" accept="image/jpeg,image/png" className="hidden" onChange={handleImageUpload} disabled={recognizing} />
            </label>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">充电前电量 (%)</label>
              <input type="number" min="0" max="100" value={batteryBefore} onChange={(e) => setBatteryBefore(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">充电后电量 (%)</label>
              <input type="number" min="0" max="100" value={batteryAfter} onChange={(e) => setBatteryAfter(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" required />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">充电类型</label>
              <select value={chargingType} onChange={(e) => setChargingType(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]">
                <option value="">未选择</option>
                <option value="dc">直流 (DC)</option>
                <option value="ac">交流 (AC)</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">电流相数</label>
              <select value={chargingPhase} onChange={(e) => setChargingPhase(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]">
                <option value="single">单相</option>
                <option value="three">三相</option>
              </select>
            </div>
          </div>

          {chargingType === 'ac' && (
            <div>
              <label className="block text-sm text-gray-600 mb-1">充电电流 (A)</label>
              <input type="number" min="1" max="256" value={chargingCurrent} onChange={(e) => setChargingCurrent(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" />
            </div>
          )}

          <div>
            <label className="block text-sm text-gray-600 mb-1">充电站名称（选填）</label>
            <input
              type="text"
              list="charging-station-options"
              value={chargingStation}
              onChange={(e) => setChargingStation(e.target.value)}
              maxLength={100}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]"
              placeholder="有站名一般为直流快充"
            />
            <datalist id="charging-station-options">
              {stationOptions.map((s) => <option key={s} value={s} />)}
            </datalist>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">预计续航 (km)</label>
            <input type="number" step="0.1" value={estimatedRange} onChange={(e) => setEstimatedRange(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">剩余里程 (km)</label>
              <input type="number" step="0.1" min="0" value={remainingRangeKm} onChange={(e) => setRemainingRangeKm(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="选填" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">充满电表显里程 (km)</label>
              <input type="number" step="0.1" min="0" value={fullChargeRangeKm} onChange={(e) => setFullChargeRangeKm(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="选填" />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">车显能耗 (kWh/100km)</label>
              <input type="number" step="0.01" min="0" value={displayConsumption} onChange={(e) => setDisplayConsumption(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="选填" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">车显消耗 (kWh)</label>
              <input type="number" step="0.01" min="0" value={consumedKwh} onChange={(e) => setConsumedKwh(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="选填" />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">车显充电电量 (kWh)</label>
              <input type="number" step="0.01" min="0" value={vehicleDisplayedKwh} onChange={(e) => setVehicleDisplayedKwh(e.target.value)}
                className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="选填" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-gray-600 mb-1">充电桩显示充电电量 (kWh)</label>
            <input type="number" step="0.01" min="0" value={chargerDisplayedKwh} onChange={(e) => setChargerDisplayedKwh(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 min-h-[44px]" placeholder="选填" />
          </div>

          {/* Electricity Details */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-medium text-gray-700">电量明细（峰谷电价）</label>
              <button type="button" onClick={addElectricityDetail}
                className="text-xs text-blue-600 min-h-[44px] px-2">+ 添加</button>
            </div>
            {electricityDetails.map((detail, i) => (
              <div key={i} className="flex gap-2 mb-2 items-center">
                <input type="number" step="0.01" placeholder="电量 kWh" value={detail.quantity}
                  onChange={(e) => {
                    const updated = [...electricityDetails];
                    updated[i] = { ...updated[i], quantity: e.target.value };
                    setElectricityDetails(updated);
                  }}
                  className="flex-1 border rounded px-2 py-1 min-h-[44px]" required />
                <input type="number" step="0.001" placeholder="单价" value={detail.unitPrice}
                  onChange={(e) => {
                    const updated = [...electricityDetails];
                    updated[i] = { ...updated[i], unitPrice: e.target.value };
                    setElectricityDetails(updated);
                  }}
                  className="flex-1 border rounded px-2 py-1 min-h-[44px]" required />
                {electricityDetails.length > 1 && (
                  <button type="button" onClick={() => removeElectricityDetail(i)}
                    className="text-red-500 min-w-[44px] min-h-[44px] flex items-center justify-center">✕</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="cf-note" className="block text-sm text-gray-600 mb-1">备注（选填）</label>
        <textarea id="cf-note" value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} rows={2}
          className="w-full border rounded-lg px-3 py-2" />
      </div>

      {error && <p className="text-red-500 text-sm">{error}</p>}

      <div className="flex gap-2">
        <button type="submit" disabled={submitting} className="bg-blue-600 text-white px-4 py-2 rounded-lg min-h-[44px] flex-1">
          {submitting ? '保存中...' : '保存'}
        </button>
        <button type="button" onClick={onCancel} className="border px-4 py-2 rounded-lg min-h-[44px]">取消</button>
      </div>
    </form>
  );
}
