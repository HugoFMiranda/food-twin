-- CreateTable
CREATE TABLE "Food" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fdcId" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "foodClass" TEXT,
    "category" TEXT,
    "publicationDate" DATETIME,
    "isUserCreated" BOOLEAN NOT NULL DEFAULT false,
    "protein" REAL,
    "carbs" REAL,
    "fat" REAL,
    "calories" REAL
);

-- CreateTable
CREATE TABLE "FoodNutrient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "foodId" TEXT NOT NULL,
    "nutrientId" INTEGER NOT NULL,
    "nutrientName" TEXT NOT NULL,
    "unitName" TEXT NOT NULL,
    "amount" REAL,
    "sourceId" INTEGER,
    CONSTRAINT "FoodNutrient_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "FoodNutrient_sourceId_fkey" FOREIGN KEY ("sourceId") REFERENCES "NutrientSource" ("sourceId") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Measure" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fdcId" INTEGER NOT NULL,
    "foodId" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "unitName" TEXT NOT NULL,
    "modifier" TEXT,
    "gramWeight" REAL NOT NULL,
    "rank" INTEGER,
    CONSTRAINT "Measure_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Brand" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "fdcId" INTEGER NOT NULL,
    "foodId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "owner" TEXT,
    CONSTRAINT "Brand_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "NutrientSource" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "sourceId" INTEGER NOT NULL,
    "code" TEXT,
    "description" TEXT
);

-- CreateTable
CREATE TABLE "MeasureUnit" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "measureId" INTEGER NOT NULL,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "FoodPortion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "foodId" TEXT NOT NULL,
    "sequenceNumber" INTEGER NOT NULL,
    "amount" REAL,
    "measureUnitId" INTEGER,
    "portionDescription" TEXT,
    "modifier" TEXT,
    "gramWeight" REAL,
    "dataPoints" INTEGER,
    "footnote" TEXT,
    "minYearAcquired" INTEGER,
    CONSTRAINT "FoodPortion_foodId_fkey" FOREIGN KEY ("foodId") REFERENCES "Food" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProteinConversionFactor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "factorId" INTEGER NOT NULL,
    "value" REAL NOT NULL
);

-- CreateIndex
CREATE UNIQUE INDEX "Food_fdcId_key" ON "Food"("fdcId");

-- CreateIndex
CREATE INDEX "Food_description_idx" ON "Food"("description");

-- CreateIndex
CREATE INDEX "Food_protein_idx" ON "Food"("protein");

-- CreateIndex
CREATE INDEX "Food_calories_idx" ON "Food"("calories");

-- CreateIndex
CREATE INDEX "Food_category_idx" ON "Food"("category");

-- CreateIndex
CREATE INDEX "Food_isUserCreated_idx" ON "Food"("isUserCreated");

-- CreateIndex
CREATE INDEX "FoodNutrient_foodId_idx" ON "FoodNutrient"("foodId");

-- CreateIndex
CREATE INDEX "FoodNutrient_nutrientId_idx" ON "FoodNutrient"("nutrientId");

-- CreateIndex
CREATE INDEX "FoodNutrient_sourceId_idx" ON "FoodNutrient"("sourceId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodNutrient_foodId_nutrientId_key" ON "FoodNutrient"("foodId", "nutrientId");

-- CreateIndex
CREATE UNIQUE INDEX "Measure_fdcId_key" ON "Measure"("fdcId");

-- CreateIndex
CREATE INDEX "Measure_foodId_idx" ON "Measure"("foodId");

-- CreateIndex
CREATE UNIQUE INDEX "Brand_fdcId_key" ON "Brand"("fdcId");

-- CreateIndex
CREATE INDEX "Brand_foodId_idx" ON "Brand"("foodId");

-- CreateIndex
CREATE INDEX "Brand_name_idx" ON "Brand"("name");

-- CreateIndex
CREATE UNIQUE INDEX "NutrientSource_sourceId_key" ON "NutrientSource"("sourceId");

-- CreateIndex
CREATE INDEX "NutrientSource_code_idx" ON "NutrientSource"("code");

-- CreateIndex
CREATE UNIQUE INDEX "MeasureUnit_measureId_key" ON "MeasureUnit"("measureId");

-- CreateIndex
CREATE INDEX "MeasureUnit_name_idx" ON "MeasureUnit"("name");

-- CreateIndex
CREATE INDEX "FoodPortion_foodId_idx" ON "FoodPortion"("foodId");

-- CreateIndex
CREATE INDEX "FoodPortion_measureUnitId_idx" ON "FoodPortion"("measureUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "FoodPortion_foodId_sequenceNumber_key" ON "FoodPortion"("foodId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "ProteinConversionFactor_factorId_key" ON "ProteinConversionFactor"("factorId");

-- CreateIndex
CREATE INDEX "ProteinConversionFactor_value_idx" ON "ProteinConversionFactor"("value");
