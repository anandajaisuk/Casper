import { generatorHandler, GeneratorOptions, DMMF } from '@prisma/generator-helper'
import { logger } from '@prisma/sdk'
import path from 'path'
import fs from 'fs/promises'
import { GENERATOR_NAME } from './constants'

const { version } = require('../package.json')

// Helper function to get relation fields
const getRelationFields = (model: DMMF.Model) => {
  return model.fields.filter(field => field.kind === 'object')
}

// Helper function to identify image/file fields based on field name patterns
const getFileFields = (model: DMMF.Model) => {
  const filePatterns = ['image', 'photo', 'picture', 'avatar', 'file', 'slip', 'attachment']
  return model.fields.filter(field =>
    field.type === 'String' &&
    filePatterns.some(pattern => field.name.toLowerCase().includes(pattern))
  )
}

const generateFileHandler = () => `
async function saveFile(file, folderName) {
    const uploadDir = path.join(process.cwd(), "public", folderName);

    if (!fs.existsSync(uploadDir)) {
        fs.mkdirSync(uploadDir, { recursive: true });
    }

    const randomId = crypto.randomUUID();
    const fileExtension = path.extname(file.name);
    const newFileName = \`\${randomId}\${fileExtension}\`;
    const filePath = path.join(uploadDir, newFileName);

    const buffer = Buffer.from(await file.arrayBuffer());
    await fs.writeFile(filePath, buffer);

    return \`/\${folderName}/\${newFileName}\`;
}
`

const generateApiRoute = (modelName: string, model: DMMF.Model) => {
  const lowerModel = modelName.toLowerCase()
  const relationFields = getRelationFields(model)
  const fileFields = getFileFields(model)

  const includeObj = relationFields.length > 0
    ? `\n    include: {\n${relationFields.map(field =>
      `      ${field.name}: true`).join(',\n')}\n    }`
    : ''

  const fileImports = fileFields.length > 0 ? `import fs from 'fs'
import crypto from 'crypto'
import path from 'path'` : ''

  const fileHandler = fileFields.length > 0 ? generateFileHandler() : ''

  return `import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
${fileImports}

const prisma = new PrismaClient()
${fileHandler}

export async function GET(req) {
  try {
    const ${lowerModel}s = await prisma.${lowerModel}.findMany({${includeObj}
    })
    return NextResponse.json(${lowerModel}s)
  } catch (error) {
    console.error('Failed to fetch ${lowerModel}s:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ${lowerModel}s' },
      { status: 500 }
    )
  }
}

export async function POST(req) {
  try {
    ${fileFields.length > 0 ? `const formData = await req.formData();
    
    // Process file uploads
    const data = {};
    ${fileFields.map(field => `
    const ${field.name}File = formData.get("${field.name}");
    if (${field.name}File && ${field.name}File.name) {
        data.${field.name} = await saveFile(${field.name}File, "${lowerModel}${field.name}s");
    }`).join('\n')}
    
    // Process other fields
    for (const [key, value] of formData.entries()) {
      if (!${fileFields.map(f => `key.startsWith("${f.name}")`).join(' && ')}) {
        try {
          // Try to parse JSON fields
          data[key] = JSON.parse(value);
        } catch {
          // If not JSON, use the value as is
          data[key] = value;
        }
      }
    }` :
      'const data = await req.json()'}

    const new${modelName} = await prisma.${lowerModel}.create({
      data,
      include: {${relationFields.map(field => `\n        ${field.name}: true`).join(',')}
      }
    })
    return NextResponse.json(new${modelName}, { status: 201 })
  } catch (error) {
    console.error('Failed to create ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to create ${lowerModel}', details: error.message },
      { status: 500 }
    )
  }
}`
}

const generateSlugApiRoute = (modelName: string, model: DMMF.Model) => {
  const lowerModel = modelName.toLowerCase()
  const relationFields = getRelationFields(model)
  const fileFields = getFileFields(model)

  const includeObj = relationFields.length > 0
    ? `\n    include: {\n${relationFields.map(field =>
      `      ${field.name}: true`).join(',\n')}\n    }`
    : ''

  const fileImports = fileFields.length > 0 ? `import fs from 'fs'
import crypto from 'crypto'
import path from 'path'` : ''

  const fileHandler = fileFields.length > 0 ? generateFileHandler() : ''

  return `import { NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
${fileImports}

const prisma = new PrismaClient()
${fileHandler}

export async function GET(req, { params }) {
  try {
    const { id } = params
    const ${lowerModel} = await prisma.${lowerModel}.findUnique({
      where: { id: parseInt(id) },${includeObj}
    })
   
    if (!${lowerModel}) {
      return NextResponse.json(
        { error: '${modelName} not found' },
        { status: 404 }
      )
    }
   
    return NextResponse.json(${lowerModel})
  } catch (error) {
    console.error('Failed to fetch ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to fetch ${lowerModel}' },
      { status: 500 }
    )
  }
}

export async function PUT(req, { params }) {
  try {
    const { id } = params
    
    const existing${modelName} = await prisma.${lowerModel}.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existing${modelName}) {
      return NextResponse.json(
        { error: '${modelName} not found' },
        { status: 404 }
      )
    }

    ${fileFields.length > 0 ? `
    // Check content type to determine if it's form data
    const contentType = req.headers.get('content-type') || '';
    
    let data;
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      data = {};

      // Process file uploads
      ${fileFields.map(field => `
      const ${field.name}File = formData.get("${field.name}");
      if (${field.name}File && ${field.name}File.name) {
        // Delete old file if it exists
        if (existing${modelName}.${field.name}) {
          const oldFilePath = path.join(process.cwd(), "public", existing${modelName}.${field.name});
          try {
            await fs.unlink(oldFilePath);
          } catch (error) {
            console.error('Failed to delete old file:', error);
          }
        }
        data.${field.name} = await saveFile(${field.name}File, "${lowerModel}${field.name}s");
      }`).join('\n')}
      
      // Process other fields
      for (const [key, value] of formData.entries()) {
        if (!${fileFields.map(f => `key.startsWith("${f.name}")`).join(' && ')}) {
          try {
            // Try to parse JSON fields
            data[key] = JSON.parse(value);
          } catch {
            // If not JSON, use the value as is
            data[key] = value;
          }
        }
      }
    } else {
      data = await req.json();
    }` : 'const data = await req.json()'}
   
    const updated${modelName} = await prisma.${lowerModel}.update({
      where: { id: parseInt(id) },
      data,
      include: {${relationFields.map(field => `\n        ${field.name}: true`).join(',')}
      }
    })
   
    return NextResponse.json(updated${modelName})
  } catch (error) {
    console.error('Failed to update ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to update ${lowerModel}', details: error.message },
      { status: 500 }
    )
  }
}

export async function DELETE(req, { params }) {
  try {
    const { id } = params
   
    const existing${modelName} = await prisma.${lowerModel}.findUnique({
      where: { id: parseInt(id) }
    })
   
    if (!existing${modelName}) {
      return NextResponse.json(
        { error: '${modelName} not found' },
        { status: 404 }
      )
    }
   
    ${fileFields.length > 0 ? `
    // Delete associated files
    ${fileFields.map(field => `
    if (existing${modelName}.${field.name}) {
      const filePath = path.join(process.cwd(), "public", existing${modelName}.${field.name});
      try {
        await fs.unlink(filePath);
      } catch (error) {
        console.error('Failed to delete file:', error);
      }
    }`).join('\n')}` : ''}

    await prisma.${lowerModel}.delete({
      where: { id: parseInt(id) }
    })
   
    return NextResponse.json(
      { message: '${modelName} deleted successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Failed to delete ${lowerModel}:', error)
    return NextResponse.json(
      { error: 'Failed to delete ${lowerModel}', details: error.message },
      { status: 500 }
    )
  }
}`
}

generatorHandler({
  onManifest() {
    logger.info(`${GENERATOR_NAME}: Registered`)
    return {
      version,
      defaultOutput: '../api',
      prettyName: GENERATOR_NAME,
    }
  },

  onGenerate: async (options: GeneratorOptions) => {
    try {
      const outputDir = path.join(options.generator.output?.value || '', '')
      await fs.mkdir(outputDir, { recursive: true })

      for (const model of options.dmmf.datamodel.models) {
        const folderPath = path.join(outputDir, model.name.toLowerCase())
        const slugFolderPath = path.join(folderPath, '[id]')

        // Create folders
        await fs.mkdir(folderPath, { recursive: true })
        await fs.mkdir(slugFolderPath, { recursive: true })

        // Generate API routes
        const indexContent = generateApiRoute(model.name, model)
        const slugContent = generateSlugApiRoute(model.name, model)

        await fs.writeFile(path.join(folderPath, 'route.ts'), indexContent, 'utf-8')
        await fs.writeFile(path.join(slugFolderPath, 'route.ts'), slugContent, 'utf-8')

        // Generate testing documentation
        const postmanCollection = generatePostmanCollection(model.name, model)

        // Write testing documentation
        await fs.writeFile(
          path.join(folderPath, 'postman-collection.json'),
          JSON.stringify(postmanCollection, null, 2),
          'utf-8'
        )


        logger.info(`Generated API routes and testing docs for model: ${model.name}`)
      }
    } catch (error) {
      logger.error('Failed to generate API routes:', error)
      throw error
    }
  },
})


// Helper to generate Postman collection for a model
const generatePostmanCollection = (modelName: string, model: DMMF.Model) => {
  const lowerModel = modelName.toLowerCase()
  const baseUrl = "http://localhost:3000"

  return {
    info: {
      name: `${modelName} API`,
      schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
    },
    item: [
      {
        name: "Get All",
        request: {
          method: "GET",
          url: {
            raw: `${baseUrl}/api/${lowerModel}`
          }
        }
      },
      {
        name: "Get By Id",
        request: {
          method: "GET",
          url: {
            raw: `${baseUrl}/api/${lowerModel}/1`
          }
        }
      },
      {
        name: "Create",
        request: {
          method: "POST",
          url: {
            raw: `${baseUrl}/api/${lowerModel}`
          },
          header: [
            {
              key: "Content-Type",
              value: "application/json"
            }
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify(
              Object.fromEntries(
                model.fields
                  .filter(f => !f.isGenerated)
                  .map(f => [
                    f.name,
                    f.kind === 'object'
                      ? { connect: { id: 1 } }
                      : f.type === 'String'
                        ? 'example'
                        : f.type === 'Int'
                          ? 1
                          : f.type === 'Boolean'
                            ? true
                            : 'value'
                  ])
              ),
              null,
              2
            )
          }
        }
      },
      {
        name: "Update",
        request: {
          method: "PUT",
          url: {
            raw: `${baseUrl}/api/${lowerModel}/1`
          },
          header: [
            {
              key: "Content-Type",
              value: "application/json"
            }
          ],
          body: {
            mode: "raw",
            raw: JSON.stringify(
              Object.fromEntries(
                model.fields
                  .filter(f => !f.isGenerated)
                  .map(f => [
                    f.name,
                    f.kind === 'object'
                      ? { connect: { id: 1 } }
                      : f.type === 'String'
                        ? 'updated example'
                        : f.type === 'Int'
                          ? 2
                          : f.type === 'Boolean'
                            ? false
                            : 'updated value'
                  ])
              ),
              null,
              2
            )
          }
        }
      },
      {
        name: "Delete",
        request: {
          method: "DELETE",
          url: {
            raw: `${baseUrl}/api/${lowerModel}/1`
          }
        }
      }
    ]
  }
}