# Microsmart – Comparador de Precios

## Requisitos

- [Node.js 18+](https://nodejs.org/) (descargar e instalar desde nodejs.org)

## Instalación (primera vez)

Abrir una terminal en la carpeta `microsmart-precios` y ejecutar:

```bash
npm install
```

## Desarrollo

```bash
npm run dev
```

Luego abrir en el navegador: **http://localhost:3000**

## Producción

```bash
npm run build
npm start
```

## Proveedores integrados

| Proveedor | Fuente |
|-----------|--------|
| BH Tech   | Google Sheets (actualización cada hora) |
| Cparts    | Google Sheets (actualización cada hora) |
| Pineapple | Dropbox Excel (actualización cada hora) |

## Agregar más proveedores

Arrastrá un archivo Excel (.xlsx) o CSV a la zona de carga en la página.

## Notas

- Los precios de las planillas públicas se actualizan automáticamente cada hora.
- Los archivos subidos manualmente solo duran hasta que se recarga la página.
- La búsqueda filtra por nombre y código de producto en tiempo real.
- El 🏆 indica el proveedor con el precio más bajo para cada producto.
