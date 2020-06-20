export default `#version 300 es
precision highp float;

layout( location = 0 ) out vec4 color;	

in vec3 _normal;
in vec3 _pos;

uniform samplerCube env;
uniform vec3 pos;
uniform vec3 sphericalHarmonics[9];

vec3 irradianceSH(vec3 n);

void main()
{
  vec3 irr = vec3(irradianceSH(normalize(_normal)));
  color = vec4(irr, 1.0f);
}

vec3 irradianceSH(vec3 n) {
    // uniform vec3 sphericalHarmonics[9]
    // We can use only the first 2 bands for better performance
    return
          sphericalHarmonics[0]
        + sphericalHarmonics[1] * (n.y)
        + sphericalHarmonics[2] * (n.z)
        + sphericalHarmonics[3] * (n.x)
        + sphericalHarmonics[4] * (n.y * n.x)
        + sphericalHarmonics[5] * (n.y * n.z)
        + sphericalHarmonics[6] * (3.0 * n.z * n.z - 1.0)
        + sphericalHarmonics[7] * (n.z * n.x)
        + sphericalHarmonics[8] * (n.x * n.x - n.y * n.y);
}

`;