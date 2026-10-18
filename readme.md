# Dulce Encanto — tienda con Webpay Plus

Tienda web responsive con catálogo, carrito, selección de despacho a domicilio o retiro, y redirección a la pasarela oficial Webpay Plus. El servidor valida productos y precios y confirma el resultado consultando Transbank. El navegador no solicita ni guarda datos de tarjeta.

## Publicar en Render
1. Crea un servicio **Web Service** conectado a este repositorio.
2. Build Command: `npm install`
3. Start Command: `npm start`
4. Agrega variables de entorno: `BASE_URL` con la URL HTTPS que Render asigne, `USE_INTEGRATION=true` para pruebas, y `WHATSAPP_NUMBER=56936672794`.
5. Primero valida todo el flujo en ambiente de integración de Transbank. Para producción, activa Webpay Plus con Transbank y configura `USE_INTEGRATION=false`, `TRANSBANK_COMMERCE_CODE` y `TRANSBANK_API_KEY` como variables privadas en Render. Nunca publiques una API key real en GitHub.

## Variables
Copia las variables de `.env.example` como variables en Render. No subas `.env` a GitHub.

## Importante antes de vender
- La aplicación mantiene los pedidos pendientes en memoria; al reiniciar el servicio se pueden perder. Antes de uso comercial, agrega una base de datos persistente para órdenes, idempotencia y seguimiento.
- Revisa el catálogo, los precios y costo de despacho antes de vender.
- La URL de retorno y las credenciales de producción deben validarse con Transbank antes de cobrar dinero real.
