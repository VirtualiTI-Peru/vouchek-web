import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Politica de Privacidad | Vouchek',
  description: 'Politica de privacidad de la aplicacion Vouchek.',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-50 px-4 py-10 text-slate-800">
      <div className="mx-auto max-w-4xl rounded-2xl border border-slate-200 bg-white p-8 shadow-sm md:p-10">
        <header className="mb-8 border-b border-slate-200 pb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-slate-900">Politica de Privacidad de Vouchek</h1>
          <p className="mt-3 text-sm text-slate-600">Fecha de entrada en vigencia: 29 de abril de 2026</p>
        </header>

        <div className="space-y-8 text-sm leading-7 text-slate-700 md:text-base">
          <section className="space-y-3">
            <p>
              En Vouchek, respetamos su privacidad y nos comprometemos a proteger la informacion personal que usted
              comparte con nosotros. Esta Politica de Privacidad describe que datos recopilamos, como los usamos y que
              opciones tiene usted respecto de su informacion al utilizar la aplicacion movil Vouchek.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">1. Responsable del tratamiento</h2>
            <p>Titular de la aplicacion: VirtualiTI EIRL</p>
            <p>Correo de contacto: contacto@virtualiti.com.pe</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">2. Informacion que recopilamos</h2>
            <p>Vouchek puede recopilar las siguientes categorias de informacion:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Informacion de cuenta, como correo electronico y datos basicos del perfil asociados al inicio de sesion.</li>
              <li>Imagenes y archivos, incluyendo fotos tomadas con la camara, imagenes elegidas desde la galeria o compartidas desde otras aplicaciones.</li>
              <li>Informacion tecnica necesaria para la autenticacion, seguridad, funcionamiento del servicio y diagnostico de errores.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">3. Permisos del dispositivo</h2>
            <p>Vouchek puede solicitar los siguientes permisos:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Camara: para capturar imagenes de comprobantes, recibos u otros documentos directamente desde la aplicacion.</li>
              <li>Fotos, archivos o galeria: para seleccionar imagenes existentes o compartir imagenes con la aplicacion para su procesamiento.</li>
            </ul>
            <p>Estos permisos se solicitan unicamente cuando son necesarios para la funcionalidad correspondiente.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">4. Como usamos la informacion</h2>
            <ul className="list-disc space-y-2 pl-6">
              <li>Permitir el acceso y autenticacion del usuario.</li>
              <li>Recibir, visualizar y gestionar imagenes de comprobantes o recibos.</li>
              <li>Enviar imagenes seleccionadas a nuestros servicios para su procesamiento.</li>
              <li>Mejorar el funcionamiento, estabilidad y seguridad de la aplicacion.</li>
              <li>Brindar soporte al usuario cuando sea necesario.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">5. Comparticion de informacion</h2>
            <p>No vendemos su informacion personal.</p>
            <p>Podemos compartir informacion unicamente en los siguientes casos:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Con proveedores tecnologicos que ayudan a operar la aplicacion y sus servicios asociados.</li>
              <li>Cuando sea necesario para procesar las imagenes y prestar la funcionalidad principal de Vouchek.</li>
              <li>Cuando la ley lo exija o sea necesario para proteger derechos, seguridad o integridad del servicio.</li>
            </ul>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">6. Almacenamiento y seguridad</h2>
            <p>
              Adoptamos medidas razonables para proteger la informacion contra acceso no autorizado, perdida, uso indebido
              o divulgacion. Sin embargo, ningun sistema es completamente seguro y no podemos garantizar seguridad absoluta.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">7. Conservacion de datos</h2>
            <p>
              Conservamos la informacion solo durante el tiempo necesario para prestar el servicio, cumplir obligaciones
              legales, resolver disputas y hacer valer nuestros acuerdos. Las imagenes o datos almacenados localmente en el
              dispositivo pueden permanecer alli hasta que el usuario los elimine o desinstale la aplicacion.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">8. Derechos del usuario</h2>
            <p>Dependiendo de la legislacion aplicable, usted puede tener derecho a:</p>
            <ul className="list-disc space-y-2 pl-6">
              <li>Acceder a su informacion.</li>
              <li>Rectificar datos inexactos.</li>
              <li>Solicitar la eliminacion de su informacion.</li>
              <li>Oponerse o limitar ciertos tratamientos de datos.</li>
            </ul>
            <p>Para ejercer estos derechos, puede contactarnos en: contacto@virtualiti.com.pe.</p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">9. Privacidad de menores de edad</h2>
            <p>
              Vouchek no esta dirigida a menores de edad y no recopila conscientemente informacion personal de menores. Si
              usted considera que un menor nos ha proporcionado informacion, contactenos para tomar las medidas correspondientes.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">10. Cambios a esta politica</h2>
            <p>
              Podemos actualizar esta Politica de Privacidad en cualquier momento. Publicaremos la version actualizada indicando
              la nueva fecha de entrada en vigencia. El uso continuado de la aplicacion despues de dichos cambios implica la
              aceptacion de la politica actualizada.
            </p>
          </section>

          <section className="space-y-3">
            <h2 className="text-xl font-semibold text-slate-900">11. Contacto</h2>
            <p>Si tiene preguntas sobre esta Politica de Privacidad o sobre el tratamiento de sus datos, puede escribirnos a:</p>
            <p>VirtualiTI EIRL</p>
            <p>contacto@virtualiti.com.pe</p>
          </section>
        </div>
      </div>
    </main>
  )
}