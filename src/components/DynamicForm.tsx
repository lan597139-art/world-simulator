// src/components/DynamicForm.tsx

// 为了保证不报错，这里把 OptionItem 改成 any，或者确保你的外部类型定义完全一致
export function SelectField({ label, value, options, onChange, lang }: { 
  label: string, value: string, options: any[], onChange: (val: string) => void, lang?: string 
}) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#333', fontSize: '0.95rem' }}>{label}</label>
      <select 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.95rem' }}
      >
        <option value="">-- 请选择 --</option>
        {options.map(opt => (
          <option key={opt.id} value={opt.id}>{opt.name_zh || opt.name}</option>
        ))}
      </select>
    </div>
  );
}

export function TagGroup({ label, selected, options, onChange, lang }: { 
  label: string, selected: string[], options: any[], onChange: (id: string) => void, lang?: string 
}) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#333', fontSize: '0.95rem' }}>{label}</label>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
        {options.map(opt => {
          const isActive = selected.includes(opt.id);
          return (
            <button
              key={opt.id}
              onClick={() => onChange(opt.id)}
              style={{
                padding: '0.4rem 0.8rem', borderRadius: '20px', border: '1px solid',
                borderColor: isActive ? '#3366ff' : '#ccc',
                background: isActive ? '#eef2ff' : '#fff',
                color: isActive ? '#3366ff' : '#555',
                cursor: 'pointer', fontSize: '0.85rem', transition: 'all 0.2s'
              }}
            >
              {opt.name_zh || opt.name}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// 👇 这里之前重复了，现在只保留这一个
export function TextField({ label, value, placeholder, onChange }: { label: string, value: string, placeholder?: string, onChange: (val: string) => void }) {
  return (
    <div style={{ marginBottom: '1.2rem' }}>
      <label style={{ display: 'block', fontWeight: 'bold', marginBottom: '0.4rem', color: '#333', fontSize: '0.95rem' }}>{label}</label>
      <input 
        type="text" 
        value={value} 
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{ width: '100%', padding: '0.6rem', borderRadius: '6px', border: '1px solid #ccc', fontSize: '0.95rem', background: '#fff' }}
      />
    </div>
  );
}