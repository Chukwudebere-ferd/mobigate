declare module 'nigeria-state-lga-data' {
  export interface NigeriaStateRecord {
    name: string
    capital: string
    lgas: string[]
    towns: string[]
  }

  interface NigeriaData {
    getStates(): string[]
    getStatesAndCapitals(): Array<{ state: string; capital: string }>
    getLgas(state: string): string[]
    getTowns(state: string): string[]
    getCapital(state: string): string
    getState(state: string): NigeriaStateRecord | null
    getStatesData(): NigeriaStateRecord[]
  }

  const data: NigeriaData
  export default data
}
