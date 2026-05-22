export type Modulo = 'locales' | 'deptos' | 'uruguay'

export interface Inquilino {
  id?: string
  user_id?: string
  modulo: 'locales' | 'deptos'
  nombre: string
  cuit: string
  direccion: string
  rubro?: string
  piso?: string
  inicio: string
  anos?: number
  vencimiento?: string
  periodo: number
  modalidad_ipc: 'esperar' | 'previo'
  blanco: number
  blanco_actual: number
  tiene_iva: boolean
  negro: number
  negro_actual: number
  diasmora: number
  created_at?: string
  updated_at?: string
}

export interface InquilinoUY {
  id?: string
  user_id?: string
  nombre: string
  documento?: string
  direccion: string
  tipo: string
  inicio: string
  anos?: number
  vencimiento?: string
  usd: number
  diasmora: number
  created_at?: string
}

export interface PagoNegro {
  id?: string
  inquilino_id: string
  fecha: string
  monto: number
  comprobante_url?: string
  comprobante_nombre?: string
  created_at?: string
}

export interface ActualizacionIPC {
  id?: string
  inquilino_id: string
  periodo: string
  ipc: number
  blanco_nuevo: number
  negro_nuevo: number
  fecha: string
}

export interface RegistroIPC {
  id?: string
  user_id?: string
  mes: string   // formato YYYY-MM
  valor: number
  created_at?: string
}
