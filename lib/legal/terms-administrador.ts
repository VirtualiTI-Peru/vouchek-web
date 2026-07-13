import type { TermsDocument } from './types';

/** Source: docs/legal/terms_administrador.html */
export const TERMS_ADMINISTRADOR: TermsDocument = {
  id: 'administrador',
  version: '2026-07-03',
  title: 'Contrato de Licencia de Software SaaS - VouChek',
  intro: [
    'Última actualización: 3 de julio de 2026',
    'Este documento constituye el acuerdo legal maestro entre la empresa contratante (en adelante, el "Cliente" o "Administrador") y VirtualiTI (en adelante, "La Empresa") para la provisión del sistema de control y validación de comprobantes denominado VouChek.',
  ],
  body: [
    {
      type: 'heading',
      text: '1. Arquitectura Multitenant y Aislamiento de Seguridad',
    },
    {
      type: 'paragraph',
      text: 'VouChek opera bajo un modelo de software como servicio (SaaS) con arquitectura Multitenant. La Empresa garantiza de forma vinculante que, si bien la infraestructura lógica en la nube de Microsoft Azure es compartida por diversos inquilinos, las bases de datos, imágenes de vouchers, algoritmos de procesamiento y analíticas del Cliente se encuentran estrictamente cifradas, aisladas y protegidas frente a cualquier acceso externo de otros usuarios del sistema.',
    },
    {
      type: 'heading',
      text: '2. Responsabilidad de Administración y Gobierno de Accesos',
    },
    {
      type: 'paragraph',
      text: 'El Administrador es el titular del Tenant corporativo y asume la responsabilidad legal exclusiva sobre la creación, asignación de permisos, mantenimiento y desactivación de las subcuentas de los usuarios de su organización, clasificados bajo los roles de:',
    },
    {
      type: 'list',
      items: [
        'Nivel 2 (Verificadores): Encargados del análisis de paneles y conciliación comercial en entorno web.',
        'Nivel 1 (Transportistas): Personal operativo encargado de la captura de imágenes en campo desde la app móvil.',
      ],
    },
    {
      type: 'heading',
      text: '3. Declaración Jurada sobre Datos de Terceros (Ley N° 29733)',
    },
    {
      type: 'paragraph',
      text: 'En estricto cumplimiento de la normativa de privacidad en el Perú, el Cliente reconoce que los vouchers cargados por su personal contienen datos financieros de sus propios clientes comerciales. El Cliente declara con carácter de declaración jurada que cuenta con las autorizaciones previas y legítimas de sus clientes y transportistas para el tratamiento automatizado de dicha información dentro de VouChek. VirtualiTI actúa exclusivamente bajo el rol de "Encargado de Tratamiento".',
    },
    {
      type: 'callout',
      text: 'Cláusula de Flujo Transfronterizo: El Cliente otorga su consentimiento expreso para que las imágenes y metadatos extraídos sean resguardados bajo la infraestructura internacional segura de Microsoft Azure, cumpliendo con los estándares requeridos por la Autoridad Nacional de Protección de Datos Personales (ANPD).',
    },
    {
      type: 'heading',
      text: '4. Limitación de Responsabilidad del Motor OCR y Calidad Fotográfica',
    },
    {
      type: 'paragraph',
      text: 'El Cliente acepta que el sistema de Reconocimiento Óptico de Caracteres (OCR) integrado procesa imágenes cuya legibilidad depende directamente del enfoque, iluminación y resolución capturada por el transportista en la ruta. VirtualiTI no asumirá ninguna responsabilidad legal ni financiera por lecturas erróneas de importes o caracteres numéricos derivados de fotografías de baja calidad o vouchers adulterados. La validación final y confirmación de los depósitos es obligación estricta del área de verificación del Cliente.',
    },
    {
      type: 'heading',
      text: '5. Tarifas de Suscripción, Tolerancia y Suspensión Automática',
    },
    {
      type: 'paragraph',
      text: 'El servicio se factura de manera periódica según los volúmenes de consumo contratados (número de usuarios o transacciones OCR ejecutadas). Tras la fecha de vencimiento de la facturación, el Cliente dispondrá de un plazo de tolerancia improrrogable de siete (7) días calendario para liquidar el saldo pendiente. Al octavo (8vo) día, VirtualiTI efectuará la suspensión total del Tenant, bloqueando el acceso a la web, pausando el OCR y desactivando el módulo de captura móvil hasta la regularización de la deuda.',
    },
  ],
  checkboxLabel:
    'Acepto los términos de licencia multitenant, el procesamiento en Azure y las políticas de pago de la suscripción.',
  acceptButtonLabel: 'Activar Licencia Corporativa de VouChek',
};
