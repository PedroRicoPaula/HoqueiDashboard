import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface SeasonOption {
  id: string
  name: string
  startDate: string
  endDate: string
  isActive: boolean
}

interface SeasonState {
  seasons: SeasonOption[]
  selectedSeasonId: string | null
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
      setSeasons: (seasons) => {
        const state = get()
        // If no selection yet, or the selected season no longer exists, default to active
        const ids = new Set(seasons.map((s) => s.id))
        const currentStillValid = state.selectedSeasonId && ids.has(state.selectedSeasonId)
        const activeSeason = seasons.find((s) => s.isActive)
        set({
          seasons,
          selectedSeasonId: currentStillValid
            ? state.selectedSeasonId
            : (activeSeason?.id ?? seasons[0]?.id ?? null),
        })
      },
      setSelectedSeason: (id) => set({ selectedSeasonId: id }),
      getSelectedSeason: () => {
        const { seasons, selectedSeasonId } = get()
        return seasons.find((s) => s.id === selectedSeasonId) ?? null
      },
      getActiveSeason: () => {
        const { seasons } = get()
        return seasons.find((s) => s.isActive) ?? null
      },
    }),
    { name: 'hm-season' }
  )
)
