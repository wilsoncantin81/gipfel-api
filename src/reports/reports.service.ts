builder
RUN npm run build
4s
> gipfel-it-api@3.0.0 build
> nest build
src/reports/reports.service.ts:85:25 - error TS2552: Cannot find name 'nodemailer'. Did you mean 'NodeFilter'?
85     const transporter = nodemailer.createTransport({
                           ~~~~~~~~~~
  node_modules/typescript/lib/lib.dom.d.ts:2557:13
    2557 declare var NodeFilter: {
                     ~~~~~~~~~~
    'NodeFilter' is declared here.
src/reports/reports.service.ts:97:21 - error TS2552: Cannot find name 'report'. Did you mean 'Report'?
97     const client = (report as any).client;
                       ~~~~~~
  node_modules/typescript/lib/lib.dom.d.ts:26060:13
    26060 declare var Report: {
                      ~~~~~~
    'Report' is declared here.
src/reports/reports.service.ts:101:39 - error TS2552: Cannot find name 'report'. Did you mean 'Report'?
101       subject: `Reporte de Servicio ${report.reportNumber}`,
                                          ~~~~~~
  node_modules/typescript/lib/lib.dom.d.ts:26060:13
    26060 declare var Report: {
                      ~~~~~~
    'Report' is declared here.
src/reports/reports.service.ts:102:28 - error TS2552: Cannot find name 'report'. Did you mean 'Report'?
102       html: `<h2>Reporte ${report.reportNumber}</h2><p>Fecha: ${new Date(report.date).toLocaleDateString('es-CO')}</p><p>${report.description}</p>`,
                               ~~~~~~
  node_modules/typescript/lib/lib.dom.d.ts:26060:13
    26060 declare var Report: {
                      ~~~~~~
    'Report' is declared here.
src/reports/reports.service.ts:102:74 - error TS2552: Cannot find name 'report'. Did you mean 'Report'?
102       html: `<h2>Reporte ${report.reportNumber}</h2><p>Fecha: ${new Date(report.date).toLocaleDateString('es-CO')}</p><p>${report.description}</p>`,
                                                                             ~~~~~~
  node_modules/typescript/lib/lib.dom.d.ts:26060:13
    26060 declare var Report: {
                      ~~~~~~
    'Report' is declared here.
src/reports/reports.service.ts:102:124 - error TS2552: Cannot find name 'report'. Did you mean 'Report'?
102       html: `<h2>Reporte ${report.reportNumber}</h2><p>Fecha: ${new Date(report.date).toLocaleDateString('es-CO')}</p><p>${report.description}</p>`,
                                                                                                                               ~~~~~~
  node_modules/typescript/lib/lib.dom.d.ts:26060:13
    26060 declare var Report: {
                      ~~~~~~
    'Report' is declared here.
Found 6 error(s).
Dockerfile:10
-------------------
8 |     RUN dos2unix prisma/schema.prisma
9 |     RUN npx prisma generate
10 | >>> RUN npm run build
11 |     FROM node:20-slim AS runner
12 |     WORKDIR /app
-------------------
ERROR: failed to build: failed to solve: process "/bin/sh -c npm run build" did not complete successfully: exit code: 1
