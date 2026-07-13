import type { TermsDocument } from './types';

/** Source: docs/legal/terms_verificador.html */
export const TERMS_VERIFICADOR: TermsDocument = {
  id: 'verificador',
  version: '2026-07-03',
  title: 'Compromiso de Confidencialidad para Verificadores',
  intro: [],
  body: [
    {
      type: 'paragraph',
      text: 'Al acceder al rol de Verificador en VouChek, el usuario reconoce y acepta que tendrá acceso directo a paneles de control, tablas de conciliación y reportes consolidados que contienen datos financieros sensibles de terceros (comprobantes bancarios, montos de dinero, identidades y números telefónicos de clientes de la organización).',
    },
    {
      type: 'paragraph',
      text: 'En estricto cumplimiento de la Ley N° 29733 (Ley de Protección de Datos Personales en el Perú), el Verificador se compromete formalmente a salvaguardar el secreto profesional, quedando terminantemente prohibido descargar de forma masiva, fotografiar con dispositivos externos, divulgar, alterar o utilizar la información procesada para fines ajenos al control de cobranza interno de la empresa.',
    },
    {
      type: 'paragraph',
      text: 'El Verificador reconoce que los tableros e información automatizada por el motor de OCR constituyen herramientas de soporte visual y que es su responsabilidad exclusiva realizar la validación final, contraste y supervisión humana de los montos antes de dar por conforme una transacción financiera corporativa.',
    },
  ],
  checkboxLabel:
    'Confirmo mi rol de verificador y acepto el compromiso de reserva y resguardo de la información.',
  acceptButtonLabel: 'Ingresar al VouChek',
};
