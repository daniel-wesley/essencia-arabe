import { createProduct, listProducts } from '../src/lib/db';

async function main() {
  const products = await listProducts();
  if (products.length === 0) {
    const seeds = [
      { name: 'Good Girl', brand: 'Carolina Herrera', family: 'Oriental', concentration: 'EdP', gender: 'F', price: 459.9, stock: 25 },
      { name: 'Sauvage', brand: 'Dior', family: 'Amadeirado', concentration: 'EdT', gender: 'M', price: 549.9, stock: 40 },
      { name: 'Black Opium', brand: 'Yves Saint Laurent', family: 'Oriental', concentration: 'EdP', gender: 'F', price: 499.9, stock: 15 },
      { name: 'Eros', brand: 'Versace', family: 'Aquatico', concentration: 'EdT', gender: 'M', price: 389.9, stock: 30 },
      { name: 'Coco Mademoiselle', brand: 'Chanel', family: 'Floral', concentration: 'EdP', gender: 'F', price: 629.9, stock: 20 },
      { name: 'Bleu de Chanel', brand: 'Chanel', family: 'Amadeirado', concentration: 'Parfum', gender: 'M', price: 579.9, stock: 0 },
    ];
    for (const p of seeds) {
      await createProduct(p);
    }
    const after = await listProducts();
    console.log(`Seed concluido: ${after.length} produtos.`);
  } else {
    console.log(`Banco ja possui ${products.length} produtos.`);
  }
}

main().catch(console.error);
