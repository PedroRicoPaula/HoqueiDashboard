import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SeasonOption {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
  defaultAthleteMonthlyFee?: number | null
  defaultMemberMonthlyQuota?: number | null
}

interface SeasonState {
  seasons: SeasonOption[]
  selectedSeasonId: string | null
  hasUserSelected: boolean
  setSeasons: (seasons: SeasonOption[]) => void
  setSelectedSeason: (id: string | null) => void
  getSelectedSeason: () => SeasonOption | null
  getActiveSeason: () => SeasonOption | null
}

export const useSeasonStore = create<SeasonState>()(
  persist(
    (set, get) => ({
      seasons: [],
      selectedSeasonId: null,
      hasUserSelected: false,
      setSeasons: (seasons) => {
        const state = get()
        const ids = new Set(seasons.map((s) => s.id))
        // "Todas as épocas" (null) é uma escolha explícita válida, tal como escolher uma
        // época concreta — só recalculamos o default se o utilizador nunca escolheu nada
        // ainda, ou se a época que tinha escolhida deixou de existir (ex: foi eliminada).
        const currentStillValid =
          state.hasUserSelected &&
          (state.selectedSeasonId === null || ids.has(state.selectedSeasonId))
        const activeSeason = seasons.find((s) => s.isActive)
        set({
          seasons,
          // Sem escolha válida: segue a época activa se existir; caso contrário "Todas as
          // épocas" — nunca adivinha a primeira época da lista (essa época pode nem estar
          // activa, e forçar a selecção escondia registos sem época atribuída).
          selectedSeasonId: currentStillValid ? state.selectedSeasonId : (activeSeason?.id ?? null),
        })
      },
      setSelectedSeason: (id) => set({ selectedSeasonId: id, hasUserSelected: true }),
      getSelectedSeason: () => {
        const { seasons, selectedSeasonId } = get()
        return seasons.find((s) => s.id === selectedSeasonId) ?? null
      },
      getActiveSeason: () => {
        const { seasons } = get()
        return seasons.find((s) => s.isActive) ?? null
      },
    }),
    { name: 'hm-season', skipHydration: true }
  )
)
