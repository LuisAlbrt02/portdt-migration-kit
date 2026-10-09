import app from './app';

const PORT = Number(process.env.PORT || 5001);

app.listen(PORT, () => {
  console.log(`Port Digital Twin backend listening on http://localhost:${PORT}`);
  console.log(`Datalake API: ${process.env.DATALAKE_API_URL || 'https://atlas.feelab.info/api'}`);
});
