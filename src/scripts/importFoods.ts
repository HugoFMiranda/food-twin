import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { parse } from 'csv-parse';
import path from 'path';

const prisma = new PrismaClient();

async function importFoods() {
  const dataDir = path.join(process.cwd(), 'src', 'scripts', 'data', 'FoodData_Central_csv_2024-10-31');

  // First, import measure units
  console.log('Importing measure units...');
  const measureUnitPath = path.join(dataDir, 'measure_unit.csv');
  const measureUnitParser = fs
    .createReadStream(measureUnitPath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  for await (const row of measureUnitParser) {
    try {
      await prisma.measureUnit.upsert({
        where: {
          measureId: parseInt(row.id)
        },
        update: {
          name: row.name
        },
        create: {
          measureId: parseInt(row.id),
          name: row.name
        }
      });
    } catch (error) {
      console.error(`Error importing measure unit ${row.id}:`, error);
    }
  }

  // Import protein conversion factors
  console.log('Importing protein conversion factors...');
  const proteinFactorPath = path.join(dataDir, 'food_protein_conversion_factor.csv');
  const proteinFactorParser = fs
    .createReadStream(proteinFactorPath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  for await (const row of proteinFactorParser) {
    try {
      await prisma.proteinConversionFactor.upsert({
        where: {
          factorId: parseInt(row.food_nutrient_conversion_factor_id)
        },
        update: {
          value: parseFloat(row.value)
        },
        create: {
          factorId: parseInt(row.food_nutrient_conversion_factor_id),
          value: parseFloat(row.value)
        }
      });
    } catch (error) {
      console.error(`Error importing protein factor ${row.food_nutrient_conversion_factor_id}:`, error);
    }
  }

  // Import nutrient sources
  console.log('Importing nutrient sources...');
  const nutrientSourcePath = path.join(dataDir, 'food_nutrient_source.csv');
  const sourceParser = fs
    .createReadStream(nutrientSourcePath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  for await (const row of sourceParser) {
    try {
      await prisma.nutrientSource.upsert({
        where: {
          sourceId: parseInt(row.id)
        },
        update: {
          code: row.code,
          description: row.description
        },
        create: {
          sourceId: parseInt(row.id),
          code: row.code,
          description: row.description
        }
      });
    } catch (error) {
      console.error(`Error importing nutrient source ${row.id}:`, error);
    }
  }

  // First, load the nutrient reference data
  const nutrientRefPath = path.join(dataDir, 'nutrient.csv');
  const nutrientMap = new Map<number, { name: string; unit: string }>();

  const nutrientRefParser = fs
    .createReadStream(nutrientRefPath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  console.log('Loading nutrient reference data...');
  for await (const row of nutrientRefParser) {
    nutrientMap.set(parseInt(row.id), {
      name: row.name,
      unit: row.unit_name
    });
  }

  // Import foods
  // const foodPath = path.join(dataDir, 'food.csv');
  // const parser = fs
  //   .createReadStream(foodPath)
  //   .pipe(parse({
  //     columns: true,
  //     skip_empty_lines: true
  //   }));

  // console.log('Starting food import...');
  // let foodCount = 0;
  // let skippedCount = 0;

  // for await (const row of parser) {
  //   try {
  //     const fdcId = parseInt(row.fdc_id);

  //     // Skip foods with FDC ID less than 1300000
  //     if (fdcId < 2000532) {
  //       skippedCount++;
  //       if (skippedCount % 1000 === 0) {
  //         console.log(`Skipped ${skippedCount} foods (below FDC ID 1300000)...`);
  //       }
  //       continue;
  //     }

  //     await prisma.food.upsert({
  //       where: {
  //         fdcId
  //       },
  //       update: {
  //         description: row.description.toLowerCase(),
  //         foodClass: row.food_class || null,
  //         category: row.food_category || null,
  //         publicationDate: row.publication_date ? new Date(row.publication_date) : null,
  //       },
  //       create: {
  //         fdcId,
  //         description: row.description.toLowerCase(),
  //         foodClass: row.food_class || null,
  //         category: row.food_category || null,
  //         publicationDate: row.publication_date ? new Date(row.publication_date) : null,
  //       },
  //     });

  //     foodCount++;
  //     if (foodCount % 1000 === 0) {
  //       console.log(`Imported ${foodCount} foods...`);
  //       console.log(`Skipped ${skippedCount} foods (below FDC ID 2000532)...`);
  //     }
  //   } catch (error) {
  //     console.error(`Error importing food ${row.fdc_id} (${row.description}):`, error);
  //   }
  // }

  // Import food portions
  console.log('Importing food portions...');
  const portionPath = path.join(dataDir, 'food_portion.csv');
  const portionParser = fs
    .createReadStream(portionPath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  let portionCount = 0;
  // for await (const row of portionParser) {
  //   try {
  //     const fdcId = parseInt(row.fdc_id);
  //     const sequenceNumber = parseInt(row.seq_num);
  //     const measureUnitId = parseInt(row.measure_unit_id);

  //     // Skip if fdcId or sequenceNumber is invalid
  //     if (isNaN(fdcId) || isNaN(sequenceNumber)) continue;

  //     const food = await prisma.food.findUnique({
  //       where: { fdcId }
  //     });

  //     if (!food) continue;

  //     await prisma.foodPortion.upsert({
  //       where: {
  //         foodId_sequenceNumber: {
  //           foodId: food.id,
  //           sequenceNumber
  //         }
  //       },
  //       update: {
  //         amount: row.amount ? parseFloat(row.amount) : null,
  //         measureUnitId: isNaN(measureUnitId) ? null : measureUnitId,
  //         portionDescription: row.portion_description || null,
  //         modifier: row.modifier || null,
  //         gramWeight: row.gram_weight ? parseFloat(row.gram_weight) : null,
  //         dataPoints: row.data_points ? parseInt(row.data_points) : null,
  //         footnote: row.footnote || null,
  //         minYearAcquired: row.min_year_acquired ? parseInt(row.min_year_acquired) : null
  //       },
  //       create: {
  //         foodId: food.id,
  //         sequenceNumber,
  //         amount: row.amount ? parseFloat(row.amount) : null,
  //         measureUnitId: isNaN(measureUnitId) ? null : measureUnitId,
  //         portionDescription: row.portion_description || null,
  //         modifier: row.modifier || null,
  //         gramWeight: row.gram_weight ? parseFloat(row.gram_weight) : null,
  //         dataPoints: row.data_points ? parseInt(row.data_points) : null,
  //         footnote: row.footnote || null,
  //         minYearAcquired: row.min_year_acquired ? parseInt(row.min_year_acquired) : null
  //       }
  //     });

  //     portionCount++;
  //     if (portionCount % 1000 === 0) {
  //       console.log(`Imported ${portionCount} portions...`);
  //     }
  //   } catch (error) {
  //     console.error(`Error importing portion for food ${row.fdc_id}:`, error);
  //   }
  // }

  // Import nutrients
  console.log('Starting nutrient import...');
  const nutrientPath = path.join(dataDir, 'food_nutrient.csv');
  const nutrientParser = fs
    .createReadStream(nutrientPath)
    .pipe(parse({
      columns: true,
      skip_empty_lines: true
    }));

  let nutrientCount = 0;
  let skippedCount = 0;

  for await (const row of nutrientParser) {
    try {
      const fdcId = parseInt(row.fdc_id);
      const nutrientId = parseInt(row.nutrient_id);

      // Skip already imported nutrients (adjust this number to where you left off)
      if (nutrientCount < 14510000) {
        nutrientCount++;
        skippedCount++;
        if (skippedCount % 10000 === 0) {
          console.log(`Skipped ${skippedCount} already imported nutrients...`);
        }
        continue;
      }

      const amount = parseFloat(row.amount);

      // Find the corresponding food
      const food = await prisma.food.findUnique({
        where: { fdcId }
      });

      if (!food) continue;

      // Get nutrient info from our reference map
      const nutrientInfo = nutrientMap.get(nutrientId);
      if (!nutrientInfo) continue;

      // Update main macros directly in food table
      if ([1003, 1004, 1005, 1008].includes(nutrientId)) {
        await prisma.food.update({
          where: { id: food.id },
          data: {
            protein: nutrientId === 1003 ? amount : undefined,
            fat: nutrientId === 1004 ? amount : undefined,
            carbs: nutrientId === 1005 ? amount : undefined,
            calories: nutrientId === 1008 ? amount : undefined,
          },
        });
      }

      // Store detailed nutrient information
      await prisma.foodNutrient.upsert({
        where: {
          foodId_nutrientId: {
            foodId: food.id,
            nutrientId: nutrientId
          }
        },
        update: {
          amount: amount,
          nutrientName: nutrientInfo.name,
          unitName: nutrientInfo.unit,
          sourceId: row.nutrient_source_id ? parseInt(row.nutrient_source_id) : null
        },
        create: {
          foodId: food.id,
          nutrientId: nutrientId,
          nutrientName: nutrientInfo.name,
          unitName: nutrientInfo.unit,
          amount: amount,
          sourceId: row.nutrient_source_id ? parseInt(row.nutrient_source_id) : null
        }
      });

      nutrientCount++;
      if (nutrientCount % 10000 === 0) {
        console.log(`Imported ${nutrientCount} nutrients...`);
      }
    } catch (error) {
      console.error(`Error importing nutrient for food ${row.fdc_id}, nutrient ${row.nutrient_id}:`, error);
    }
  }

  await prisma.$disconnect();
  console.log(`Import completed: 
    - ${nutrientCount} nutrients
    - ${portionCount} portions imported`);
}

importFoods().catch(console.error); 