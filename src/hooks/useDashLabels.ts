'use client'

import { useMemo } from 'react'
import { useAuthStore } from '@/store/authStore'
import { useDashT } from './useDashT'

import ptDict from '../../messages/dashboard/pt.json'
import enDict from '../../messages/dashboard/en.json'
import esDict from '../../messages/dashboard/es.json'
import frDict from '../../messages/dashboard/fr.json'
import itDict from '../../messages/dashboard/it.json'

type DashDict = typeof ptDict
const DICTS: Record<string, DashDict> = { pt: ptDict, en: enDict, es: esDict, fr: frDict, it: itDict }

export function useDashLabels() {
  const lang = useAuthStore((s) => s.clubLanguage) ?? 'pt'
  const dict = DICTS[lang] ?? DICTS.pt
  const t = useDashT()

  return useMemo(() => ({
    monthsShort: dict.months.short as string[],
    monthsFull: dict.months.full as string[],

    ageGroups: {
      SUB11:   t('ageGroups.SUB11'),
      SUB13:   t('ageGroups.SUB13'),
      SUB15:   t('ageGroups.SUB15'),
      SUB17:   t('ageGroups.SUB17'),
      SUB19:   t('ageGroups.SUB19'),
      SENIORS: t('ageGroups.SENIORS'),
    } as Record<string, string>,

    materialStates: {
      FREE:     t('materialStates.FREE'),
      ASSIGNED: t('materialStates.ASSIGNED'),
      DAMAGED:  t('materialStates.DAMAGED'),
    } as Record<string, string>,

    textileStates: {
      STOCK:    t('textileStates.STOCK'),
      ASSIGNED: t('textileStates.ASSIGNED'),
      DAMAGED:  t('textileStates.DAMAGED'),
      LOST:     t('textileStates.LOST'),
    } as Record<string, string>,

    textileCategories: {
      GAME:     t('textileCategories.GAME'),
      TRAINING: t('textileCategories.TRAINING'),
      OTHER:    t('textileCategories.OTHER'),
    } as Record<string, string>,

    textileTypes: {
      GAME_SHIRT:     t('textileTypes.GAME_SHIRT'),
      GAME_SHORTS:    t('textileTypes.GAME_SHORTS'),
      GAME_SOCKS:     t('textileTypes.GAME_SOCKS'),
      GK_SHIRT:       t('textileTypes.GK_SHIRT'),
      TRAINING_TOP:   t('textileTypes.TRAINING_TOP'),
      TRAINING_PANTS: t('textileTypes.TRAINING_PANTS'),
      TRAINING_KIT:   t('textileTypes.TRAINING_KIT'),
      JACKET:         t('textileTypes.JACKET'),
      TSHIRT:         t('textileTypes.TSHIRT'),
      OTHER:          t('textileTypes.OTHER'),
    } as Record<string, string>,

    materialCategories: {
      ATHLETE:    t('materialCategories.ATHLETE'),
      GOALKEEPER: t('materialCategories.GOALKEEPER'),
      SMALL:      t('materialCategories.SMALL'),
    } as Record<string, string>,

    directionRoles: {
      TRAINER:           t('directionRoles.TRAINER'),
      ASSISTANT_TRAINER: t('directionRoles.ASSISTANT_TRAINER'),
      DIRECTOR:          t('directionRoles.DIRECTOR'),
      SECCIONISTA:       t('directionRoles.SECCIONISTA'),
      SOCORRISTA:        t('directionRoles.SOCORRISTA'),
      FIELD_DIRECTOR:    t('directionRoles.FIELD_DIRECTOR'),
    } as Record<string, string>,

    sessionTypes: {
      GENERAL:       t('sessionTypes.GENERAL'),
      GOALKEEPERS:   t('sessionTypes.GOALKEEPERS'),
      FIELD_PLAYERS: t('sessionTypes.FIELD_PLAYERS'),
      SPECIFIC:      t('sessionTypes.SPECIFIC'),
    } as Record<string, string>,

    sponsorTypes: {
      EQUIPMENT_SENIOR:    t('sponsorTypes.EQUIPMENT_SENIOR'),
      EQUIPMENT_FORMATION: t('sponsorTypes.EQUIPMENT_FORMATION'),
      NAMING_RIGHTS:       t('sponsorTypes.NAMING_RIGHTS'),
      BANNER:              t('sponsorTypes.BANNER'),
      STICKS:              t('sponsorTypes.STICKS'),
      SHINGUARDS:          t('sponsorTypes.SHINGUARDS'),
      OTHER:               t('sponsorTypes.OTHER'),
      all:                 t('sponsorTypes.all'),
    } as Record<string, string>,

    auditActions: {
      CREATE:             t('auditActions.CREATE'),
      UPDATE:             t('auditActions.UPDATE'),
      DELETE:             t('auditActions.DELETE'),
      LOGIN:              t('auditActions.LOGIN'),
      LOGIN_FAIL:         t('auditActions.LOGIN_FAIL'),
      LOGOUT:             t('auditActions.LOGOUT'),
      CHANGE_PASSWORD:    t('auditActions.CHANGE_PASSWORD'),
      CHANGE_PERMISSIONS: t('auditActions.CHANGE_PERMISSIONS'),
      all:                t('auditActions.all'),
    } as Record<string, string>,

    auditEntities: {
      Athlete:          t('auditEntities.Athlete'),
      Member:           t('auditEntities.Member'),
      Material:         t('auditEntities.Material'),
      TextileItem:      t('auditEntities.TextileItem'),
      Sponsor:          t('auditEntities.Sponsor'),
      Travel:           t('auditEntities.Travel'),
      DirectionMember:  t('auditEntities.DirectionMember'),
      Training:         t('auditEntities.Training'),
      TrainingSession:  t('auditEntities.TrainingSession'),
      TrainingSchedule: t('auditEntities.TrainingSchedule'),
      AttendanceRecord: t('auditEntities.AttendanceRecord'),
      User:             t('auditEntities.User'),
      Quota:            t('auditEntities.Quota'),
      AthletePayment:   t('auditEntities.AthletePayment'),
      all:              t('auditEntities.all'),
    } as Record<string, string>,
  }), [t, dict])
}
