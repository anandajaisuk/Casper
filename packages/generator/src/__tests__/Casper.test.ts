import { genEnum } from '../helpers/genEnum'
import { getSampleDMMF } from './__fixtures__/getSampleDMMF'

test('Casper NextAPI', async () => {
  const sampleDMMF = await getSampleDMMF()

  sampleDMMF.datamodel.enums.forEach((enumInfo) => {
    expect(genEnum(enumInfo)).toMatchSnapshot(enumInfo.name)
  })
})
